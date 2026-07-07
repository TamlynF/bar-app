"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateGrounded, parseJsonLoose } from "@/lib/gemini";
import { parseGbp } from "@/lib/price";
import { buildPricesPrompt } from "../lib/prompts";
import { refreshTrendsAction } from "../trends/actions";
import {
  ensureMarketingSettings,
  readCompanyAddress,
  resolveComparisonArea,
  deriveAreaFromAddress,
} from "../lib/settings";
import type { AiCompetitorPrice, CompetitorItemType, MenuItemLite } from "../lib/types";

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

const ITEM_TYPES: CompetitorItemType[] = ["drink", "snack", "food"];
function normalizeItemType(raw?: string): CompetitorItemType | null {
  const v = (raw ?? "").toLowerCase().trim();
  return ITEM_TYPES.includes(v as CompetitorItemType) ? (v as CompetitorItemType) : null;
}

async function readMenuItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<MenuItemLite[]> {
  const { data } = await supabase
    .from("menu_categories")
    .select("name, menu_items(id, name, price, is_active)")
    .eq("is_active", true);
  const rows: MenuItemLite[] = [];
  (data ?? []).forEach((cat: { name: string; menu_items?: { id: number; name: string; price: string; is_active: boolean }[] }) => {
    (cat.menu_items ?? [])
      .filter((it) => it.is_active)
      .forEach((it) => rows.push({ id: it.id, name: it.name, price: it.price, category: cat.name }));
  });
  return rows;
}

/**
 * Fetch current competitor prices for the comparison area via Gemini (grounded),
 * parse into GBP amounts, and replace the stored set for that area.
 */
export async function refreshPricesAction(): Promise<
  { success: true; count: number } | { error: string }
> {
  const supabase = await createClient();
  const [address, employeeId, menuItems] = await Promise.all([
    readCompanyAddress(supabase),
    currentEmployeeId(supabase),
    readMenuItems(supabase),
  ]);
  const settings = await ensureMarketingSettings(supabase, deriveAreaFromAddress(address));
  const area = resolveComparisonArea(settings, address);

  const res = await generateGrounded(buildPricesPrompt(area, settings?.comparison_radius ?? null, menuItems));
  if ("error" in res) return { error: res.error };

  const parsed = parseJsonLoose<AiCompetitorPrice[]>(res.text) ?? [];
  const rows = parsed
    .filter((p) => p?.venue_name && p?.item_name)
    .map((p) => ({
      venue_name: p.venue_name.trim(),
      item_name: p.item_name.trim(),
      item_type: normalizeItemType(p.item_type),
      price_text: p.price_text?.trim() || null,
      price_amount: parseGbp(p.price_text),
      area,
      source_url: p.source_url?.trim() || null,
      source_name: p.source_name?.trim() || null,
    }));

  if (rows.length === 0) {
    return { error: "The AI didn't return any usable prices. Try refreshing again." };
  }

  // Replace the set for this area so results stay consistent and current.
  await supabase.from("competitor_prices").delete().eq("area", area);
  const { error } = await supabase.from("competitor_prices").insert(rows);
  if (error) {
    console.error("Error saving competitor prices:", error);
    return { error: error.message };
  }

  if (settings?.id) {
    await supabase
      .from("marketing_settings")
      .update({ last_prices_refresh_at: new Date().toISOString(), updated_by: employeeId })
      .eq("id", settings.id);
  }

  revalidatePath("/marketing/prices");
  revalidatePath("/marketing/trends"); // Prices tab is also embedded on the Trends page.
  return { success: true, count: rows.length };
}

/**
 * "Live AI: local price insights" — refreshes competitor prices for the table
 * AND generates fresh price-positioning idea cards, in one click.
 */
export async function refreshPriceInsightsAction(): Promise<
  { success: true; priceCount: number; ideaCount: number } | { error: string }
> {
  const [prices, ideas] = await Promise.all([
    refreshPricesAction(),
    refreshTrendsAction("price"),
  ]);

  // Only a hard fail if both halves failed.
  if ("error" in prices && "error" in ideas) {
    return { error: prices.error };
  }
  return {
    success: true,
    priceCount: "error" in prices ? 0 : prices.count,
    ideaCount: "error" in ideas ? 0 : ideas.added,
  };
}

/** Update the editable comparison area / radius. */
export async function updateComparisonAreaAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const employeeId = await currentEmployeeId(supabase);
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
  revalidatePath("/marketing/trends"); // Prices tab is also embedded on the Trends page.
  return { success: true };
}
