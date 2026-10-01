import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";
import { isStockTrackedAt } from "@/lib/market/square-stock-tracking";
import { syncLinkedMenuCategories } from "@/lib/market/variation-categories";

/* The nightly copy of the Square catalog into square_catalog_variations,
   one row per item variation. The menu links to Square by variation id; this
   copy is what the app reads to compare against Square without a live call. */

type CatalogItemObject = Extract<Square.CatalogObject, { type: "ITEM" }>;
type CatalogVariationObject = Extract<Square.CatalogObject, { type: "ITEM_VARIATION" }>;

export type CatalogVariationRow = {
  variation_id: string;
  item_id: string;
  item_name: string;
  variation_name: string;
  sku: string | null;
  product_type: string | null;
  pricing_type: string | null;
  price: number | null;
  currency: string | null;
  reporting_category_id: string | null;
  reporting_category_name: string | null;
  category_ids: string[];
  category_names: string[];
  menu_ids: string[];
  menu_names: string[];
  modifier_list_ids: string[];
  modifier_list_names: string[];
  is_alcoholic: boolean;
  inventory_tracking: boolean;
  inventory_tracking_location: boolean;
  stock_tracking: "stock_count" | "not_tracked";
  stock_quantity: number | null;
  sold_by: string | null;
  sold_out_at: string[];
  status: "Active" | "Archived";
  status_ext: string;
  sellable: boolean | null;
  stockable: boolean | null;
  is_archived: boolean;
  at_location: boolean;
  item_updated_at: string | null;
  variation_updated_at: string | null;
  synced_at: string;
  deleted_at: null;
};

export type CatalogSyncResult =
  | { status: "ok"; variations: number; modifierLists: number; removed: number }
  | { status: "error"; error: string };

function presentAt(
  obj: Pick<Square.CatalogObjectBase, "presentAtAllLocations" | "presentAtLocationIds" | "absentAtLocationIds">,
  locationId: string
): boolean {
  if (obj.presentAtAllLocations === false) return (obj.presentAtLocationIds ?? []).includes(locationId);
  return !(obj.absentAtLocationIds ?? []).includes(locationId);
}

function toPounds(money: Square.Money | undefined): number | null {
  if (money?.amount == null) return null;
  return Math.round(Number(money.amount)) / 100;
}

function namesFor(ids: string[], names: Map<string, string>): string[] {
  return ids.map((id) => names.get(id) ?? "");
}

/* What Square needs beyond the catalog listing: its location names, for
   sold_out_at, and the venue's in-stock counts, for status_ext. */
export type CatalogExtras = {
  locationNames: Map<string, string>;
  stockByVariation: Map<string, number>;
};

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

/* The label in the Status column of Square's item library for one
   variation at the venue. */
export function squareStatusLabel(input: {
  soldOut: boolean;
  tracked: boolean;
  quantity: number | null;
  soldBy: string | null;
}): string {
  if (input.soldOut) return "Sold out";
  if (input.tracked && input.quantity != null && input.quantity > 0) {
    return `${formatQuantity(input.quantity)}${input.soldBy ? ` ${input.soldBy}` : ""} available`;
  }
  return "Available";
}

type CategoryInfo = { name: string; isMenu: boolean; parentId: string | null };

/* A menu category's full path in Square's Menus, top level first, e.g.
   "Don Fenticas Hinckley > Spirits > Liqueurs". */
function menuPath(id: string, categories: Map<string, CategoryInfo>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const category = categories.get(current);
    if (!category) break;
    names.unshift(category.name);
    current = category.parentId;
  }
  return names.join(" > ");
}

/* Flattens a catalog listing (items, categories and modifier lists) into one
   row per variation. Category and modifier list names are looked up from the
   same listing, so an id Square no longer has comes back as an empty name. */
export function catalogToVariationRows(
  objects: Square.CatalogObject[],
  locationId: string,
  syncedAt: string,
  extras: CatalogExtras = { locationNames: new Map(), stockByVariation: new Map() }
): CatalogVariationRow[] {
  const categories = new Map<string, CategoryInfo>();
  const unitAbbreviations = new Map<string, string>();
  const categoryNames = new Map<string, string>();
  const modifierListNames = new Map<string, string>();
  for (const obj of objects) {
    if (obj.type === "CATEGORY" && obj.id && obj.categoryData?.name) {
      categoryNames.set(obj.id, obj.categoryData.name);
      categories.set(obj.id, {
        name: obj.categoryData.name,
        isMenu: obj.categoryData.categoryType === "MENU_CATEGORY",
        parentId: obj.categoryData.parentCategory?.id ?? null,
      });
    }
    if (obj.type === "MODIFIER_LIST" && obj.modifierListData?.name) modifierListNames.set(obj.id, obj.modifierListData.name);
    const abbreviation = obj.type === "MEASUREMENT_UNIT" ? obj.measurementUnitData?.measurementUnit?.customUnit?.abbreviation : null;
    if (obj.id && abbreviation) unitAbbreviations.set(obj.id, abbreviation);
  }

  const rows: CatalogVariationRow[] = [];
  for (const obj of objects) {
    if (obj.type !== "ITEM" || !obj.itemData) continue;
    const item = obj as CatalogItemObject;
    const data = item.itemData!;
    const assignedIds = (data.categories ?? []).flatMap((category) => (category.id ? [category.id] : []));
    if (assignedIds.length === 0 && data.categoryId) assignedIds.push(data.categoryId);
    const menuIds = assignedIds.filter((id) => categories.get(id)?.isMenu);
    const categoryIds = assignedIds.filter((id) => !categories.get(id)?.isMenu);
    const modifierListIds = (data.modifierListInfo ?? [])
      .filter((info) => info.enabled !== false)
      .map((info) => info.modifierListId);
    const reportingCategoryId = data.reportingCategory?.id ?? null;
    const itemAtLocation = presentAt(item, locationId);

    for (const child of data.variations ?? []) {
      if (child.type !== "ITEM_VARIATION" || !child.id) continue;
      const variation = child as CatalogVariationObject;
      const v = variation.itemVariationData;
      const trackedHere = isStockTrackedAt(v, locationId);
      const soldOutIds = (v?.locationOverrides ?? []).flatMap((entry) =>
        entry.soldOut && entry.locationId ? [entry.locationId] : []
      );
      const stockQuantity = extras.stockByVariation.get(variation.id) ?? null;
      const soldBy = v?.measurementUnitId ? (unitAbbreviations.get(v.measurementUnitId) ?? null) : null;
      rows.push({
        variation_id: variation.id,
        item_id: item.id,
        item_name: data.name ?? "",
        variation_name: v?.name ?? "",
        sku: v?.sku ?? null,
        product_type: data.productType ?? null,
        pricing_type: v?.pricingType ?? null,
        price: toPounds(v?.priceMoney),
        currency: v?.priceMoney?.currency ?? null,
        reporting_category_id: reportingCategoryId,
        reporting_category_name: reportingCategoryId ? (categoryNames.get(reportingCategoryId) ?? null) : null,
        category_ids: categoryIds,
        category_names: namesFor(categoryIds, categoryNames),
        menu_ids: menuIds,
        menu_names: menuIds.map((id) => menuPath(id, categories)),
        modifier_list_ids: modifierListIds,
        modifier_list_names: namesFor(modifierListIds, modifierListNames),
        is_alcoholic: Boolean(data.isAlcoholic),
        inventory_tracking: Boolean(v?.trackInventory),
        inventory_tracking_location: trackedHere,
        stock_tracking: v?.trackInventory ? "stock_count" : "not_tracked",
        stock_quantity: stockQuantity,
        sold_by: soldBy,
        sold_out_at: soldOutIds.map((id) => extras.locationNames.get(id) ?? id),
        status: data.isArchived ? "Archived" : "Active",
        status_ext: squareStatusLabel({
          soldOut: soldOutIds.includes(locationId),
          tracked: trackedHere,
          quantity: stockQuantity,
          soldBy,
        }),
        sellable: v?.sellable ?? null,
        stockable: v?.stockable ?? null,
        is_archived: Boolean(data.isArchived),
        at_location: itemAtLocation && presentAt(variation, locationId),
        item_updated_at: item.updatedAt ?? null,
        variation_updated_at: variation.updatedAt ?? null,
        synced_at: syncedAt,
        deleted_at: null,
      });
    }
  }
  return rows;
}

export type CatalogModifierRow = { id: string; name: string; price: number | null };

export type CatalogModifierListRow = {
  modifier_list_id: string;
  name: string;
  modifiers: CatalogModifierRow[];
  updated_at: string | null;
  synced_at: string;
  deleted_at: null;
};

/* One row per Square modifier list, its options in Square's order. */
export function catalogToModifierListRows(objects: Square.CatalogObject[], syncedAt: string): CatalogModifierListRow[] {
  return objects.flatMap((obj) => {
    if (obj.type !== "MODIFIER_LIST" || !obj.id) return [];
    return [
      {
        modifier_list_id: obj.id,
        name: obj.modifierListData?.name ?? "",
        modifiers: (obj.modifierListData?.modifiers ?? []).flatMap((modifier) =>
          modifier.type === "MODIFIER" && modifier.id
            ? [
                {
                  id: modifier.id,
                  name: modifier.modifierData?.name ?? "",
                  price: toPounds(modifier.modifierData?.priceMoney),
                },
              ]
            : []
        ),
        updated_at: obj.updatedAt ?? null,
        synced_at: syncedAt,
        deleted_at: null,
      },
    ];
  });
}

const CHUNK = 500;

async function upsertAndRetire(
  supabase: SupabaseClient,
  table: string,
  key: string,
  rows: Record<string, unknown>[],
  syncedAt: string
): Promise<number> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: key });
    if (error) throw new Error(error.message);
  }
  const { data: removed, error } = await supabase
    .from(table)
    .update({ deleted_at: syncedAt })
    .lt("synced_at", syncedAt)
    .is("deleted_at", null)
    .select(key);
  if (error) throw new Error(error.message);
  return removed?.length ?? 0;
}

async function fetchLocationNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const res = await squareClient.locations.list();
  for (const location of res.locations ?? []) {
    if (location.id) names.set(location.id, location.name ?? location.id);
  }
  return names;
}

async function fetchStock(variationIds: string[], locationId: string): Promise<Map<string, number>> {
  const stock = new Map<string, number>();
  for (let i = 0; i < variationIds.length; i += CHUNK) {
    const page = await squareClient.inventory.batchGetCounts({
      catalogObjectIds: variationIds.slice(i, i + CHUNK),
      locationIds: [locationId],
      states: ["IN_STOCK"],
    });
    for await (const count of page) {
      if (!count.catalogObjectId) continue;
      const quantity = Number(count.quantity ?? 0);
      if (Number.isFinite(quantity)) stock.set(count.catalogObjectId, (stock.get(count.catalogObjectId) ?? 0) + quantity);
    }
  }
  return stock;
}

function variationIdsOf(objects: Square.CatalogObject[]): string[] {
  return objects.flatMap((obj) =>
    obj.type === "ITEM" ? (obj.itemData?.variations ?? []).flatMap((v) => (v.id ? [v.id] : [])) : []
  );
}

async function writeSyncState(supabase: SupabaseClient, now: Date, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from("square_sync_state")
    .update({ catalog_run_at: now.toISOString(), updated_at: now.toISOString(), ...fields })
    .eq("id", 1);
  if (error) console.error("[square-catalog-sync] state write failed:", error);
}

export async function syncSquareCatalog(supabase: SupabaseClient, now: Date = new Date()): Promise<CatalogSyncResult> {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) return { status: "error", error: "SQUARE_LOCATION_ID not set" };
  const syncedAt = now.toISOString();

  try {
    const objects: Square.CatalogObject[] = [];
    const page = await squareClient.catalog.list({ types: "ITEM,CATEGORY,MODIFIER_LIST,MEASUREMENT_UNIT" });
    for await (const obj of page) objects.push(obj);
    const [locationNames, stockByVariation] = await Promise.all([
      fetchLocationNames(),
      fetchStock(variationIdsOf(objects), locationId),
    ]);
    const rows = catalogToVariationRows(objects, locationId, syncedAt, { locationNames, stockByVariation });
    if (rows.length === 0) throw new Error("Square returned no catalog items, so the copy was left as it was.");

    const removed = await upsertAndRetire(supabase, "square_catalog_variations", "variation_id", rows, syncedAt);
    const modifierLists = catalogToModifierListRows(objects, syncedAt);
    await upsertAndRetire(supabase, "square_catalog_modifier_lists", "modifier_list_id", modifierLists, syncedAt);
    await syncLinkedMenuCategories(supabase).catch((err) =>
      console.error("[square-catalog-sync] menu category refresh failed:", err)
    );

    await writeSyncState(supabase, now, {
      catalog_synced_at: syncedAt,
      catalog_status: "ok",
      catalog_error: null,
      catalog_variations: rows.length,
    });
    return { status: "ok", variations: rows.length, modifierLists: modifierLists.length, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[square-catalog-sync] failed:", err);
    await writeSyncState(supabase, now, { catalog_status: "error", catalog_error: message });
    return { status: "error", error: message };
  }
}
