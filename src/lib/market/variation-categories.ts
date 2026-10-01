import type { SupabaseClient } from "@supabase/supabase-js";

export type VariationCategoryRow = {
  variation_id: string;
  menu_category_id: number | null;
  menu_category_manual: boolean;
};

/* The writes that bring each variation's menu category in line with the
   serve it is linked to, grouped by the category to write (null clears it).
   A category picked by hand is left alone. */
export function linkedCategoryUpdates(
  rows: VariationCategoryRow[],
  linkedCategory: Map<string, number>
): Map<number | null, string[]> {
  const updates = new Map<number | null, string[]>();
  for (const row of rows) {
    if (row.menu_category_manual) continue;
    const want = linkedCategory.get(row.variation_id) ?? null;
    if (want === (row.menu_category_id == null ? null : Number(row.menu_category_id))) continue;
    updates.set(want, [...(updates.get(want) ?? []), row.variation_id]);
  }
  return updates;
}

type LinkRow = {
  id: number;
  square_variation_id: string | null;
  menu_items: { category_id: number } | { category_id: number }[] | null;
};

const PAGE = 1000;
const ID_CHUNK = 200;

async function readLinkedCategories(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("menu_item_prices")
    .select("id, square_variation_id, menu_items(category_id)")
    .not("square_variation_id", "is", null)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  const linked = new Map<string, number>();
  for (const row of (data ?? []) as LinkRow[]) {
    const item = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
    if (row.square_variation_id && item && !linked.has(row.square_variation_id)) {
      linked.set(row.square_variation_id, Number(item.category_id));
    }
  }
  return linked;
}

async function readCategoryRows(supabase: SupabaseClient, variationIds?: string[]): Promise<VariationCategoryRow[]> {
  const columns = "variation_id, menu_category_id, menu_category_manual";
  const rows: VariationCategoryRow[] = [];
  if (variationIds) {
    const ids = [...new Set(variationIds)];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await supabase
        .from("square_catalog_variations")
        .select(columns)
        .in("variation_id", ids.slice(i, i + ID_CHUNK));
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as VariationCategoryRow[]));
    }
    return rows;
  }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select(columns)
      .order("variation_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as VariationCategoryRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/* Re-points the menu category of the given variations (every variation when
   none are named) at the category of the serve each is linked to. Run after
   anything that changes a link or adds variations to the copy. */
export async function syncLinkedMenuCategories(supabase: SupabaseClient, variationIds?: string[]): Promise<void> {
  const ids = variationIds?.filter(Boolean);
  if (ids && ids.length === 0) return;
  const [linked, rows] = await Promise.all([readLinkedCategories(supabase), readCategoryRows(supabase, ids)]);
  for (const [categoryId, targets] of linkedCategoryUpdates(rows, linked)) {
    for (let i = 0; i < targets.length; i += ID_CHUNK) {
      const { error } = await supabase
        .from("square_catalog_variations")
        .update({ menu_category_id: categoryId })
        .in("variation_id", targets.slice(i, i + ID_CHUNK));
      if (error) throw new Error(error.message);
    }
  }
}
