"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateGrounded, parseJsonLoose } from "@/lib/gemini";
import { formatGbp } from "@/lib/price";
import { buildAdvertisingTrendsPrompt, buildEventIdeasPrompt, buildPriceTrendsPrompt } from "../lib/prompts";
import { buildComparison } from "../lib/compare";
import { trendSignature } from "../lib/signature";
import {
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
  deriveAreaFromAddress,
} from "../lib/settings";
import type { AiTrend, CompetitorPrice, MenuItemLite, TrendEffort, TrendKind, TrendState } from "../lib/types";

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

async function buildPriceContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  area: string,
): Promise<string> {
  const { data: cats } = await supabase
    .from("menu_categories")
    .select("name, menu_items(id, name, price, is_active)")
    .eq("is_active", true);
  const menuItems: MenuItemLite[] = [];
  (cats ?? []).forEach(
    (cat: { name: string; menu_items?: { id: number; name: string; price: string; is_active: boolean }[] }) => {
      (cat.menu_items ?? [])
        .filter((it) => it.is_active)
        .forEach((it) => menuItems.push({ id: it.id, name: it.name, price: it.price, category: cat.name }));
    },
  );

  const { data: comp } = await supabase
    .from("competitor_prices")
    .select("id, venue_name, item_name, item_type, price_text, price_amount, area, source_url, source_name, fetched_at")
    .eq("area", area);
  const competitorPrices = (comp ?? []) as CompetitorPrice[];
  if (!competitorPrices.length && !menuItems.length) return "";

  const gapLines = buildComparison(competitorPrices, menuItems)
    .filter((c) => c.ownPrice != null && c.competitorAvg != null && c.sampleCount > 0)
    .map((c) => {
      const diff = (c.ownPrice as number) - (c.competitorAvg as number);
      const stance =
        diff < -0.01 ? `£${Math.abs(diff).toFixed(2)} UNDER` : diff > 0.01 ? `£${diff.toFixed(2)} OVER` : "level with";
      return `- ${c.label}: you ${formatGbp(c.ownPrice)}${c.ownItemName ? ` (${c.ownItemName})` : ""} vs local ${formatGbp(c.competitorMin)}–${formatGbp(c.competitorMax)} (avg ${formatGbp(c.competitorAvg)}) across ${c.sampleCount} venue${c.sampleCount === 1 ? "" : "s"} → you're ${stance} local avg`;
    });

  const venueSamples = new Map<string, string>();
  competitorPrices.forEach((p) => {
    if (!venueSamples.has(p.venue_name)) {
      venueSamples.set(p.venue_name, `${p.item_name} ${p.price_text || formatGbp(p.price_amount)}`);
    }
  });
  const venueLines = Array.from(venueSamples)
    .slice(0, 8)
    .map(([venue, sample]) => `- ${venue}: e.g. ${sample}`);

  const parts: string[] = [];
  if (gapLines.length) parts.push(`YOUR PRICE vs LOCAL AVG (${area}):\n${gapLines.join("\n")}`);
  if (venueLines.length) parts.push(`NAMED NEARBY VENUES (quote these by name):\n${venueLines.join("\n")}`);
  return parts.join("\n\n");
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

  const kinds: TrendKind[] = kind ? [kind] : ["advertising", "event_idea"];

  const { data: dismissed } = await supabase
    .from("marketing_trends")
    .select("title")
    .in("state", ["saved", "ignored"])
    .in("kind", kinds)
    .order("updated_at", { ascending: false })
    .limit(40);
  const blocklist = (dismissed ?? []).map((d) => d.title).filter(Boolean);

  const priceContext = kinds.includes("price") ? await buildPriceContext(supabase, area) : "";

  const jobs = kinds.map((k) => ({
    kind: k,
    prompt:
      k === "advertising"
        ? buildAdvertisingTrendsPrompt(area, todayISO, blocklist)
        : k === "price"
          ? buildPriceTrendsPrompt(area, settings?.comparison_radius ?? null, todayISO, priceContext, blocklist)
          : buildEventIdeasPrompt(area, todayISO, blocklist),
  }));
  const results = await Promise.all(jobs.map((j) => generateGrounded(j.prompt)));

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
