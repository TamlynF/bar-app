import type { SupabaseClient } from "@supabase/supabase-js";

export type ModifierOptionDetail = { name: string; price: number | null };

export type ModifierListDetail = { id: string; name: string; options: ModifierOptionDetail[] };

/* One variation as the catalog copy holds it, for showing Square's side of a
   linked serve. Rows Square has since removed are included, with deletedAt. */
export type SquareVariationDetail = {
  itemId: string;
  itemName: string;
  variationId: string;
  variationName: string;
  pricingType: string | null;
  price: number | null;
  currency: string | null;
  reportingCategoryName: string | null;
  modifierLists: ModifierListDetail[];
  inventoryTrackingLocation: boolean;
  stockTracking: string;
  stockQuantity: number | null;
  soldBy: string | null;
  soldOutAt: string[];
  status: string;
  statusExt: string;
  sellable: boolean | null;
  stockable: boolean | null;
  isArchived: boolean;
  syncedAt: string;
  deletedAt: string | null;
};

export type VariationDetailRow = {
  variation_id: string;
  item_id: string;
  item_name: string;
  variation_name: string;
  pricing_type: string | null;
  price: number | string | null;
  currency: string | null;
  reporting_category_name: string | null;
  modifier_list_ids: string[] | null;
  modifier_list_names: string[] | null;
  inventory_tracking_location: boolean;
  stock_tracking: string;
  stock_quantity: number | string | null;
  sold_by: string | null;
  sold_out_at: string[] | null;
  status: string;
  status_ext: string;
  sellable: boolean | null;
  stockable: boolean | null;
  is_archived: boolean;
  synced_at: string;
  deleted_at: string | null;
};

export type ModifierListDetailRow = {
  modifier_list_id: string;
  name: string;
  modifiers: { id: string; name: string; price: number | string | null }[] | null;
};

const optionalNumber = (value: number | string | null): number | null => (value == null ? null : Number(value));

/* A list the copy no longer holds still shows under the name the variation
   carries, with no options. */
export function squareVariationDetailFromRow(
  row: VariationDetailRow,
  lists: Map<string, ModifierListDetailRow>
): SquareVariationDetail {
  const listNames = row.modifier_list_names ?? [];
  return {
    itemId: row.item_id,
    itemName: row.item_name,
    variationId: row.variation_id,
    variationName: row.variation_name,
    pricingType: row.pricing_type,
    price: optionalNumber(row.price),
    currency: row.currency,
    reportingCategoryName: row.reporting_category_name,
    modifierLists: (row.modifier_list_ids ?? []).map((id, index) => {
      const list = lists.get(id);
      return {
        id,
        name: list?.name || listNames[index] || id,
        options: (list?.modifiers ?? [])
          .filter((modifier) => modifier.name)
          .map((modifier) => ({ name: modifier.name, price: optionalNumber(modifier.price) })),
      };
    }),
    inventoryTrackingLocation: row.inventory_tracking_location,
    stockTracking: row.stock_tracking,
    stockQuantity: optionalNumber(row.stock_quantity),
    soldBy: row.sold_by,
    soldOutAt: row.sold_out_at ?? [],
    status: row.status,
    statusExt: row.status_ext,
    sellable: row.sellable,
    stockable: row.stockable,
    isArchived: row.is_archived,
    syncedAt: row.synced_at,
    deletedAt: row.deleted_at,
  };
}

const ID_CHUNK = 200;

export async function readSquareVariationDetails(
  supabase: SupabaseClient,
  variationIds: (string | null)[]
): Promise<Record<string, SquareVariationDetail>> {
  const ids = [...new Set(variationIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  const rows: VariationDetailRow[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select(
        "variation_id, item_id, item_name, variation_name, pricing_type, price, currency, reporting_category_name, modifier_list_ids, modifier_list_names, inventory_tracking_location, stock_tracking, stock_quantity, sold_by, sold_out_at, status, status_ext, sellable, stockable, is_archived, synced_at, deleted_at"
      )
      .in("variation_id", ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as VariationDetailRow[]));
  }

  const listIds = [...new Set(rows.flatMap((row) => row.modifier_list_ids ?? []))];
  const lists = new Map<string, ModifierListDetailRow>();
  if (listIds.length > 0) {
    const { data, error } = await supabase
      .from("square_catalog_modifier_lists")
      .select("modifier_list_id, name, modifiers")
      .in("modifier_list_id", listIds);
    if (error) throw new Error(error.message);
    for (const list of (data ?? []) as ModifierListDetailRow[]) lists.set(list.modifier_list_id, list);
  }

  return Object.fromEntries(rows.map((row) => [row.variation_id, squareVariationDetailFromRow(row, lists)]));
}
