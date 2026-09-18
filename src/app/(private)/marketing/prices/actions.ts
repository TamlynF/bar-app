"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { refreshTrendsAction } from "../trends/actions";
import {
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
  deriveAreaFromAddress,
} from "../lib/settings";
import { captureRivalFromUrl } from "../lib/persist-capture";
import { rivalStartUrls } from "../lib/rivals";
import type { MarketingCompetitor } from "../lib/types";

const MAX_CAPTURE_PER_REFRESH = 8;

export async function refreshPricesAction(): Promise<
  | {
      success: true;
      count: number;
      capturedVenues: number;
      skippedNoMenu: number;
      failed: number;
    }
  | { error: string }
> {
  const supabase = await createClient();
  const [address, employeeId] = await Promise.all([
    readCompanyAddress(supabase),
    getCurrentEmployeeId(supabase),
  ]);
  const settings = await ensureMarketingSettings(supabase, deriveAreaFromAddress(address));
  const area = resolveComparisonArea(settings, address);

  const { data: rivalsRaw } = await supabase
    .from("marketing_competitors")
    .select("*")
    .eq("area", area)
    .eq("is_pinned", true);

  const rivals = (rivalsRaw as MarketingCompetitor[] | null) ?? [];
  if (!rivals.length) {
    return { error: "Pin some rivals under Settings → Rivals first, then run this again." };
  }

  const withUrl = rivals.filter((r) => rivalStartUrls(r).length);
  if (!withUrl.length) {
    return { error: "Pinned rivals need a website, menu URL, or board photo under Settings → Rivals." };
  }
  const skippedNoMenu = rivals.length - withUrl.length;
  const toRun = withUrl.slice(0, MAX_CAPTURE_PER_REFRESH);

  let count = 0;
  let capturedVenues = 0;
  let failed = 0;

  for (const rival of toRun) {
    const result = await captureRivalFromUrl(supabase, rival);
    if ("error" in result) {
      console.error(`Capture failed for ${rival.name}:`, result.error);
      failed += 1;
    } else {
      count += result.count;
      capturedVenues += 1;
    }
  }

  if (capturedVenues === 0 && toRun.length > 0) {
    return { error: "Could not read a menu for any pinned rival. Add a menu URL or a board photo under Settings → Rivals." };
  }

  if (settings?.id) {
    await supabase
      .from("marketing_settings")
      .update({ last_prices_refresh_at: new Date().toISOString(), updated_by: employeeId })
      .eq("id", settings.id);
  }

  revalidatePath("/marketing/prices");
  revalidatePath("/marketing/trends");
  revalidatePath("/settings/rivals");
  return { success: true, count, capturedVenues, skippedNoMenu: skippedNoMenu + (withUrl.length - toRun.length), failed };
}

export async function refreshPriceInsightsAction(): Promise<
  { success: true; priceCount: number; ideaCount: number; skippedNoMenu: number; failed: number } | { error: string }
> {
  const [prices, ideas] = await Promise.all([
    refreshPricesAction(),
    refreshTrendsAction("price"),
  ]);

  if ("error" in prices) return { error: prices.error };
  return {
    success: true,
    priceCount: "error" in prices ? 0 : prices.count,
    ideaCount: "error" in ideas ? 0 : ideas.added,
    skippedNoMenu: "error" in prices ? 0 : prices.skippedNoMenu,
    failed: "error" in prices ? 0 : prices.failed,
  };
}

export async function updateComparisonAreaAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const area = formData.get("comparison_area")?.toString().trim() || null;
  const radius = formData.get("comparison_radius")?.toString().trim() || null;

  const settings = await ensureMarketingSettings(supabase, area);
  if (!settings?.id) {
    return { error: "Couldn't load marketing settings. Please try again." };
  }
  const { error } = await supabase
    .from("marketing_settings")
    .update({ comparison_area: area, comparison_radius: radius, updated_at: new Date().toISOString(), updated_by: employeeId })
    .eq("id", settings.id);
  if (error) {
    console.error("Error updating comparison area:", error);
    return { error: error.message };
  }
  revalidatePath("/marketing/prices");
  revalidatePath("/marketing/trends");
  revalidatePath("/settings/rivals");
  return { success: true };
}
