"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  deriveAreaFromAddress,
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
} from "@/app/(private)/marketing/lib/settings";
import { geocodeAddress, searchNearbyPubs } from "@/app/(private)/marketing/lib/places";
import { parseRadiusMeters, planDiscover, rivalStartUrls } from "@/app/(private)/marketing/lib/rivals";
import { captureRivalFromUpload, captureRivalFromUrl } from "@/app/(private)/marketing/lib/persist-capture";
import { MENU_UPLOAD_MAX_BYTES, MENU_UPLOAD_TYPES } from "@/app/(private)/marketing/lib/capture-menu";
import type { MarketingCompetitor } from "@/app/(private)/marketing/lib/types";

function revalidate() {
  revalidatePath("/settings/rivals");
  revalidatePath("/marketing/trends");
  revalidatePath("/marketing/prices");
}

async function loadContext() {
  const supabase = await createClient();
  const address = await readCompanyAddress(supabase);
  const settings = await ensureMarketingSettings(supabase, deriveAreaFromAddress(address));
  const area = resolveComparisonArea(settings, address);
  return { supabase, address, settings, area };
}

async function ownNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase.from("company_information").select("name").limit(1).maybeSingle();
  return ["Don Fenticas", data?.name].filter((n): n is string => !!n?.trim());
}

async function loadRival(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<MarketingCompetitor | null> {
  const { data } = await supabase.from("marketing_competitors").select("*").eq("id", id).maybeSingle();
  return (data as MarketingCompetitor | null) ?? null;
}

export async function discoverRivalsAction(): Promise<
  | {
      success: true;
      added: number;
      updated: number;
      skippedOwn: number;
      skippedIndustry: number;
      unpinned: number;
      menusCaptured: number;
    }
  | { error: string }
> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return { error: "GOOGLE_MAPS_API_KEY is not set. Enable Geocoding and Places on that key." };
  }

  const { supabase, address, settings, area } = await loadContext();
  const geoQuery = settings?.comparison_area?.trim() || address;
  if (!geoQuery) return { error: "Set a comparison area on the price-off first." };

  const geo = await geocodeAddress(geoQuery, apiKey);
  if ("error" in geo) return geo;

  let hits;
  try {
    hits = await searchNearbyPubs({
      lat: geo.lat,
      lng: geo.lng,
      radiusMeters: parseRadiusMeters(settings?.comparison_radius),
      apiKey,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Places search failed." };
  }

  const { data: existing } = await supabase
    .from("marketing_competitors")
    .select("id, place_id, is_pinned, name")
    .eq("area", area);

  const plan = planDiscover(hits, existing ?? [], await ownNames(supabase));
  const now = new Date().toISOString();
  const toCapture: MarketingCompetitor[] = [];

  if (plan.inserts.length) {
    const { data: inserted, error } = await supabase
      .from("marketing_competitors")
      .insert(
        plan.inserts.map((hit) => ({
          place_id: hit.placeId,
          name: hit.name,
          website: hit.website,
          address: hit.address,
          area,
          is_pinned: true,
          fetched_at: now,
        })),
      )
      .select("*");
    if (error) return { error: error.message };
    toCapture.push(...((inserted as MarketingCompetitor[] | null) ?? []));
  }

  for (const upd of plan.updates) {
    const { data, error } = await supabase
      .from("marketing_competitors")
      .update({
        name: upd.name,
        website: upd.website,
        address: upd.address,
        fetched_at: now,
        updated_at: now,
      })
      .eq("id", upd.id)
      .select("*")
      .maybeSingle();
    if (error) return { error: error.message };
    if (data) toCapture.push(data as MarketingCompetitor);
  }

  for (const unpin of plan.unpins) {
    const { error } = await supabase
      .from("marketing_competitors")
      .update({ is_pinned: false, updated_at: now })
      .eq("id", unpin.id);
    if (error) return { error: error.message };
  }

  let menusCaptured = 0;
  for (const rival of toCapture) {
    if (!rivalStartUrls(rival).length) continue;
    const result = await captureRivalFromUrl(supabase, rival);
    if (!("error" in result)) menusCaptured += 1;
  }

  revalidate();
  return {
    success: true,
    added: plan.inserts.length,
    updated: plan.updates.length,
    skippedOwn: plan.skippedOwn.length,
    skippedIndustry: plan.skippedIndustry.length,
    unpinned: plan.unpins.length,
    menusCaptured,
  };
}

export async function saveRivalAction(
  formData: FormData,
): Promise<{ success: true; captured?: number; captureError?: string } | { error: string }> {
  const { supabase, area } = await loadContext();
  const id = formData.get("id")?.toString().trim() || null;
  const name = formData.get("name")?.toString().trim() || "";
  const website = formData.get("website")?.toString().trim() || null;
  const menuUrls = (formData.get("menu_urls")?.toString() ?? "")
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);
  const isPinned = formData.get("is_pinned") !== "false";

  if (!name) return { error: "A venue name is required." };

  const previous = id ? await loadRival(supabase, id) : null;
  const websiteChanged = (website ?? "") !== (previous?.website ?? "");
  const menusChanged =
    menuUrls.join("\n") !== (previous?.menu_urls ?? []).join("\n") && menuUrls.length > 0;
  const payload = {
    name,
    website,
    menu_urls: menuUrls,
    menu_url: menuUrls[0] ?? null,
    is_pinned: isPinned,
    updated_at: new Date().toISOString(),
  };

  let saved: MarketingCompetitor | null = previous;
  if (id) {
    const { data, error } = await supabase
      .from("marketing_competitors")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return { error: error.message };
    saved = (data as MarketingCompetitor | null) ?? previous;
  } else {
    const { data, error } = await supabase
      .from("marketing_competitors")
      .insert({ ...payload, area, is_pinned: true })
      .select("*")
      .maybeSingle();
    if (error) return { error: error.message };
    saved = data as MarketingCompetitor | null;
  }

  const shouldCapture =
    !!saved && rivalStartUrls(saved).length > 0 && (!id || websiteChanged || menusChanged);
  let captured: number | undefined;
  let captureError: string | undefined;
  if (shouldCapture && saved) {
    const result = await captureRivalFromUrl(supabase, saved);
    if ("error" in result) captureError = result.error;
    else captured = result.count;
  }

  revalidate();
  return { success: true, captured, captureError };
}

export async function setRivalPinnedAction(
  id: string,
  isPinned: boolean,
): Promise<{ success: true } | { error: string }> {
  const { supabase } = await loadContext();
  const { error } = await supabase
    .from("marketing_competitors")
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function deleteRivalAction(id: string): Promise<{ success: true } | { error: string }> {
  const { supabase } = await loadContext();
  const { error } = await supabase.from("marketing_competitors").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function captureRivalUrlAction(
  id: string,
): Promise<{ success: true; count: number } | { error: string }> {
  const { supabase } = await loadContext();
  const rival = await loadRival(supabase, id);
  if (!rival) return { error: "That rival could not be found." };
  try {
    const result = await captureRivalFromUrl(supabase, rival);
    if ("error" in result) return result;
    revalidate();
    return { success: true, count: result.count };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read that menu." };
  }
}

export async function captureAllRivalMenusAction(): Promise<
  | { success: true; captured: number; failed: number; skipped: number; prices: number }
  | { error: string }
> {
  const { supabase, area } = await loadContext();
  const { data } = await supabase
    .from("marketing_competitors")
    .select("*")
    .eq("area", area)
    .order("name", { ascending: true });
  const rivals = (data as MarketingCompetitor[] | null) ?? [];
  if (!rivals.length) return { error: "Find nearby pubs first." };

  let captured = 0;
  let failed = 0;
  let skipped = 0;
  let prices = 0;

  for (const rival of rivals) {
    if (!rivalStartUrls(rival).length) {
      skipped += 1;
      continue;
    }
    try {
      const result = await captureRivalFromUrl(supabase, rival);
      if ("error" in result) {
        failed += 1;
      } else {
        captured += 1;
        prices += result.count;
      }
    } catch {
      failed += 1;
    }
  }

  revalidate();
  if (captured === 0) {
    return {
      error:
        skipped === rivals.length
          ? "None of these rivals have a website or drinks menu URL yet."
          : `Could not read drink prices from any site (${failed} failed). Try Find drinks menus, or upload a board photo.`,
    };
  }
  return { success: true, captured, failed, skipped, prices };
}

export async function captureRivalUploadAction(
  formData: FormData,
): Promise<{ success: true; count: number } | { error: string }> {
  const { supabase } = await loadContext();
  const id = formData.get("id")?.toString().trim();
  if (!id) return { error: "That rival could not be found." };
  const rival = await loadRival(supabase, id);
  if (!rival) return { error: "That rival could not be found." };

  const uploads = formData.getAll("file").filter((file): file is File => file instanceof File && file.size > 0);
  if (!uploads.length) {
    return { error: "Choose a PDF or photo of the drinks board first." };
  }
  for (const file of uploads) {
    if (!MENU_UPLOAD_TYPES.includes(file.type)) {
      return { error: "That file type is not supported - upload a PDF, PNG or JPEG." };
    }
    if (file.size > MENU_UPLOAD_MAX_BYTES) {
      return { error: "That file is too large - keep it under 15MB." };
    }
  }

  const result = await captureRivalFromUpload(
    supabase,
    rival,
    await Promise.all(
      uploads.map(async (file) => ({
        bytes: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
      })),
    ),
  );
  if ("error" in result) return result;
  revalidate();
  return { success: true, count: result.count };
}
