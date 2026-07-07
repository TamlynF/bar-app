"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateGrounded, parseJsonLoose } from "@/lib/gemini";
import { buildAdvertisingTrendsPrompt, buildEventIdeasPrompt } from "../lib/prompts";
import { trendSignature } from "../lib/signature";
import {
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
  deriveAreaFromAddress,
} from "../lib/settings";
import type { AiTrend, TrendEffort, TrendKind, TrendState } from "../lib/types";

function normalizeEffort(raw?: string): TrendEffort | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.startsWith("eas")) return "Easy";
  if (v.startsWith("med")) return "Medium";
  if (v.startsWith("big") || v.startsWith("hard") || v.startsWith("lar")) return "Big";
  return null;
}

async function currentEmployeeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  return emp?.id ?? null;
}

function toRows(kind: TrendKind, area: string, aiTrends: AiTrend[], employeeId: number | null) {
  return aiTrends
    .filter((t) => t?.title)
    .map((t) => ({
      kind,
      title: t.title.trim(),
      summary: t.summary?.trim() || null,
      relevance: t.relevance?.trim() || null,
      action: t.action?.trim() || null,
      effort: normalizeEffort(t.effort),
      category: t.category?.trim() || null,
      source_url: t.source_url?.trim() || null,
      source_name: t.source_name?.trim() || null,
      tags: Array.isArray(t.tags) ? t.tags.slice(0, 6).map((x) => String(x)) : [],
      signature: trendSignature(kind, t.title, t.source_name),
      area,
      created_by: employeeId,
      updated_by: employeeId,
    }));
}

/**
 * Fetch fresh trends from Gemini (grounded on Google Search), dedupe on
 * `signature` so saved/ignored trends never resurface, and cache them.
 *
 * Pass a `kind` to scan only that tab (advertising OR event ideas); omit it to
 * scan both.
 */
export async function refreshTrendsAction(
  kind?: TrendKind,
): Promise<{ success: true; added: number } | { error: string }> {
  const supabase = await createClient();
  const [address, employeeId] = await Promise.all([
    readCompanyAddress(supabase),
    currentEmployeeId(supabase),
  ]);
  const settings = await ensureMarketingSettings(supabase, deriveAreaFromAddress(address));
  const area = resolveComparisonArea(settings, address);
  const todayISO = new Date().toISOString().split("T")[0];

  // Only scan the requested kind(s).
  const kinds: TrendKind[] = kind ? [kind] : ["advertising", "event_idea"];

  // Feed already-triaged titles (of the same kind) back to the model so it avoids
  // near-identical repeats (semantic de-dup on top of the exact-signature DB de-dup).
  const { data: dismissed } = await supabase
    .from("marketing_trends")
    .select("title")
    .in("state", ["saved", "ignored"])
    .in("kind", kinds)
    .order("updated_at", { ascending: false })
    .limit(40);
  const blocklist = (dismissed ?? []).map((d) => d.title).filter(Boolean);

  const jobs = kinds.map((k) => ({
    kind: k,
    prompt:
      k === "advertising"
        ? buildAdvertisingTrendsPrompt(area, todayISO, blocklist)
        : buildEventIdeasPrompt(area, todayISO, blocklist),
  }));
  const results = await Promise.all(jobs.map((j) => generateGrounded(j.prompt)));

  // If every call failed, surface the first error.
  if (results.every((r) => "error" in r)) {
    const firstError = results.find((r) => "error" in r) as { error: string };
    return { error: firstError.error };
  }

  const rows = jobs.flatMap((job, i) => {
    const res = results[i];
    return "text" in res ? toRows(job.kind, area, parseJsonLoose<AiTrend[]>(res.text) ?? [], employeeId) : [];
  });

  if (rows.length === 0) {
    return { error: "The AI didn't return any usable trends. Try refreshing again." };
  }

  // Insert new trends only; existing signatures (incl. saved/ignored) are left untouched.
  const { error, count } = await supabase
    .from("marketing_trends")
    .upsert(rows, { onConflict: "signature", ignoreDuplicates: true, count: "exact" });

  if (error) {
    console.error("Error saving trends:", error);
    return { error: error.message };
  }

  if (settings?.id) {
    await supabase
      .from("marketing_settings")
      .update({ last_trends_refresh_at: new Date().toISOString(), updated_by: employeeId })
      .eq("id", settings.id);
  }

  revalidatePath("/marketing/trends");
  return { success: true, added: count ?? 0 };
}

/** Save / ignore / restore a trend (direct state assignment). */
export async function setTrendStateAction(
  id: string,
  state: TrendState,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const employeeId = await currentEmployeeId(supabase);
  const { error } = await supabase
    .from("marketing_trends")
    .update({ state, updated_at: new Date().toISOString(), updated_by: employeeId })
    .eq("id", id);
  if (error) {
    console.error("Error updating trend state:", error);
    return { error: error.message };
  }
  revalidatePath("/marketing/trends");
  return { success: true };
}
