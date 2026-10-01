import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogVariation } from "./mapping";
import { mixerListPrice, type SquareModifierList } from "./mixer";
import type { ModifierListOption } from "./square-mixers";

/* The Square catalog as the nightly sync last copied it into
   square_catalog_variations, shaped for the Square links page. Reading the
   copy keeps the page off Square entirely; variations Square has since
   deleted are left out. */
export type CatalogCopy = {
  variations: CatalogVariation[];
  itemIdByVariation: Record<string, string>;
  untrackedVariationIds: string[];
};

type CatalogCopyRow = {
  variation_id: string;
  item_id: string;
  item_name: string;
  variation_name: string;
  inventory_tracking_location: boolean;
};

const PAGE = 1000;

export function catalogCopyFromRows(rows: CatalogCopyRow[]): CatalogCopy {
  const sorted = [...rows].sort(
    (a, b) => a.item_name.localeCompare(b.item_name) || a.variation_name.localeCompare(b.variation_name)
  );
  return {
    variations: sorted.map((row) => ({
      variationId: row.variation_id,
      itemName: row.item_name,
      variationName: row.variation_name,
    })),
    itemIdByVariation: Object.fromEntries(sorted.map((row) => [row.variation_id, row.item_id])),
    untrackedVariationIds: sorted.filter((row) => !row.inventory_tracking_location).map((row) => row.variation_id),
  };
}

/* Null when the copy cannot be read or has never been filled, so the page
   can offer to copy it from Square rather than show an empty dropdown. */
export async function readCatalogCopy(supabase: SupabaseClient): Promise<CatalogCopy | null> {
  const rows: CatalogCopyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select("variation_id, item_id, item_name, variation_name, inventory_tracking_location")
      .is("deleted_at", null)
      .order("variation_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[market] catalog copy read failed:", error);
      return null;
    }
    rows.push(...((data ?? []) as CatalogCopyRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows.length > 0 ? catalogCopyFromRows(rows) : null;
}

type VariationFlagsRow = {
  variation_id: string;
  item_id: string;
  item_name: string;
  modifier_list_ids: string[] | null;
  inventory_tracking_location: boolean;
};

const ID_CHUNK = 200;

async function readVariationRows(supabase: SupabaseClient, variationIds: string[]): Promise<VariationFlagsRow[]> {
  const ids = [...new Set(variationIds)];
  const rows: VariationFlagsRow[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select("variation_id, item_id, item_name, modifier_list_ids, inventory_tracking_location")
      .is("deleted_at", null)
      .in("variation_id", ids.slice(i, i + ID_CHUNK));
    if (error) throw error;
    rows.push(...((data ?? []) as VariationFlagsRow[]));
  }
  return rows;
}

/* Whether Square tracks each variation's stock at the venue. A variation
   missing from the copy is left out, so callers keep what they had. */
export async function readStockTracking(supabase: SupabaseClient, variationIds: string[]): Promise<Map<string, boolean>> {
  const rows = await readVariationRows(supabase, variationIds);
  return new Map(rows.map((row) => [row.variation_id, row.inventory_tracking_location]));
}

/* The Square item behind each variation, for links into the dashboard. */
export async function readItemIds(supabase: SupabaseClient, variationIds: string[]): Promise<Map<string, string>> {
  const rows = await readVariationRows(supabase, variationIds);
  return new Map(rows.map((row) => [row.variation_id, row.item_id]));
}

type ModifierListRow = {
  modifier_list_id: string;
  name: string;
  modifiers: { id: string; name: string; price: number | null }[] | null;
};

export function modifierListFromRow(row: ModifierListRow): SquareModifierList {
  const modifiers = row.modifiers ?? [];
  return {
    id: row.modifier_list_id,
    name: row.name,
    modifierPrices: modifiers.flatMap((modifier) => (modifier.price == null ? [] : [Number(modifier.price)])),
    modifierIds: modifiers.map((modifier) => modifier.id),
  };
}

async function readModifierListRows(supabase: SupabaseClient, listIds?: string[]): Promise<ModifierListRow[]> {
  let query = supabase
    .from("square_catalog_modifier_lists")
    .select("modifier_list_id, name, modifiers")
    .is("deleted_at", null);
  if (listIds) {
    if (listIds.length === 0) return [];
    query = query.in("modifier_list_id", [...new Set(listIds)]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ModifierListRow[];
}

export type MixerInfo = {
  listIdsByVariation: Map<string, string[]>;
  lists: Map<string, SquareModifierList>;
};

/* For each variation, the modifier lists switched on for its item, and those
   lists with their option prices: everything the mixer price is worked out
   from. */
export async function readMixerInfo(supabase: SupabaseClient, variationIds: string[]): Promise<MixerInfo> {
  const rows = await readVariationRows(supabase, variationIds);
  const listIdsByVariation = new Map(rows.map((row) => [row.variation_id, row.modifier_list_ids ?? []]));
  const listRows = await readModifierListRows(supabase, rows.flatMap((row) => row.modifier_list_ids ?? []));
  return {
    listIdsByVariation,
    lists: new Map(listRows.map((row) => [row.modifier_list_id, modifierListFromRow(row)])),
  };
}

export function modifierListOptionsFromRows(
  lists: ModifierListRow[],
  variations: { item_id: string; item_name: string; modifier_list_ids: string[] | null }[]
): ModifierListOption[] {
  const itemNamesByList = new Map<string, Map<string, string>>();
  for (const variation of variations) {
    for (const listId of variation.modifier_list_ids ?? []) {
      const items = itemNamesByList.get(listId) ?? new Map<string, string>();
      items.set(variation.item_id, variation.item_name);
      itemNamesByList.set(listId, items);
    }
  }
  return lists
    .map((row) => {
      const list = modifierListFromRow(row);
      return {
        id: list.id,
        name: list.name || "Untitled modifier list",
        modifierNames: (row.modifiers ?? []).flatMap((modifier) => (modifier.name ? [modifier.name] : [])),
        price: mixerListPrice(list.modifierPrices),
        mixedPrices: new Set(list.modifierPrices.map((price) => Math.round(price * 100))).size > 1,
        itemNames: [...(itemNamesByList.get(list.id)?.values() ?? [])].sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* Every modifier list in the copy with what it offers and which items carry
   it, for choosing the mixer on the Square links page. */
export async function readModifierListOptions(supabase: SupabaseClient): Promise<ModifierListOption[]> {
  const [lists, variations] = await Promise.all([
    readModifierListRows(supabase),
    (async () => {
      const rows: { item_id: string; item_name: string; modifier_list_ids: string[] | null }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("square_catalog_variations")
          .select("item_id, item_name, modifier_list_ids")
          .is("deleted_at", null)
          .order("variation_id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as typeof rows));
        if (!data || data.length < PAGE) return rows;
      }
    })(),
  ]);
  return modifierListOptionsFromRows(lists, variations);
}

/* Square's fixed price for each variation the copy still holds; variations
   with variable pricing, or gone from Square, are left out. */
export async function readSquarePrices(supabase: SupabaseClient, variationIds: (string | null)[]): Promise<Map<string, number>> {
  const ids = [...new Set(variationIds.filter((id): id is string => Boolean(id)))];
  const prices = new Map<string, number>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select("variation_id, price")
      .is("deleted_at", null)
      .not("price", "is", null)
      .in("variation_id", ids.slice(i, i + ID_CHUNK));
    if (error) throw error;
    for (const row of (data ?? []) as { variation_id: string; price: number | string }[]) {
      const price = Number(row.price);
      if (Number.isFinite(price) && price > 0) prices.set(row.variation_id, price);
    }
  }
  return prices;
}
