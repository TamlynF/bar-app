import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseName } from "@/lib/menu-import";
import { normalizeServe } from "@/lib/menu-price";
import { sortServes } from "./event-serves";
import { proposeMappings, splitLinks, suggestMappings, type CatalogVariation } from "./mapping";
import { mixerListPrice } from "./mixer";

export type MixerOption = { name: string; price: number | null };

export type MixerOnItem = { name: string; options: MixerOption[]; price: number | null };

export type SquareItemRow = {
  variationId: string;
  itemId: string;
  itemName: string;
  variationName: string;
  price: number | null;
  reportingCategory: string | null;
  statusExt: string;
  archived: boolean;
  mixers: MixerOnItem[];
  menuCategoryId: number | null;
  menuCategoryManual: boolean;
  linkedServeId: number | null;
  linkedCategoryId: number | null;
  suggestedServeId: number | null;
};

export type ServeOption = {
  menuItemPriceId: number;
  itemName: string;
  serve: string;
  amount: number;
  categoryId: number;
  categoryName: string;
  squareVariationId: string | null;
  hidden: boolean;
};

export type MenuCategoryOption = { id: number; name: string };

export type CatalogItemCopyRow = {
  variation_id: string;
  item_id: string;
  item_name: string;
  variation_name: string;
  price: number | string | null;
  reporting_category_name: string | null;
  status: string;
  status_ext: string;
  is_archived: boolean;
  modifier_list_ids: string[] | null;
  menu_category_id: number | string | null;
  menu_category_manual: boolean;
};

export type ModifierListCopyRow = {
  modifier_list_id: string;
  name: string;
  modifiers: { id: string; name: string; price: number | null }[] | null;
};

export type ServeCategoryRow = {
  id: number;
  name: string;
  menu_items: {
    id: number;
    name: string;
    is_active: boolean;
    show_on_menu?: boolean;
    menu_item_prices: {
      id: number;
      serve: string;
      amount: number | string;
      display_order: number;
      square_variation_id: string | null;
      show_on_menu?: boolean;
    }[];
  }[];
};

/* The serve a menu row created for a Square variation gets: one of the
   menu's own serves when the variation reads as one ("Pint", "Single"),
   "each" for Square's "Regular", otherwise Square's wording ("pitcher",
   "shot tray"). */
export function hiddenServeLabel(variationName: string): string {
  const serve = normalizeServe(variationName);
  if (serve) return serve;
  const name = normaliseName(variationName);
  return !name || name === "regular" ? "each" : name;
}

export function isMixerList(name: string): boolean {
  return /mixer/i.test(name);
}

export type MenuItemOption = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  hidden: boolean;
  serves: string[];
};

/* Every active menu item, hidden ones included, for attaching a Square
   variation to an item that already exists. */
export function menuItemOptionsFrom(categories: ServeCategoryRow[]): MenuItemOption[] {
  return categories.flatMap((category) =>
    category.menu_items
      .filter((item) => item.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        id: Number(item.id),
        name: item.name,
        categoryId: Number(category.id),
        categoryName: category.name,
        hidden: item.show_on_menu === false,
        serves: item.menu_item_prices.map((price) => price.serve),
      }))
  );
}

/* The item the dialog starts on: one of that name in the variation's own
   category, then anywhere on the menu; null means a new item. */
export function defaultMenuItem(
  items: MenuItemOption[],
  itemName: string,
  categoryId: number | null
): MenuItemOption | null {
  const named = items.filter((item) => normaliseName(item.name) === normaliseName(itemName));
  return named.find((item) => item.categoryId === categoryId) ?? named[0] ?? null;
}

export function serveOptionsFrom(categories: ServeCategoryRow[]): ServeOption[] {
  return categories.flatMap((category) =>
    category.menu_items
      .filter((item) => item.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((item) =>
        sortServes(item.menu_item_prices).map((price) => ({
          menuItemPriceId: price.id,
          itemName: item.name,
          serve: price.serve,
          amount: Number(price.amount),
          categoryId: Number(category.id),
          categoryName: category.name,
          squareVariationId: price.square_variation_id,
          hidden: item.show_on_menu === false || price.show_on_menu === false,
        }))
      )
  );
}

/* One row per Square variation in the copy, carrying the menu serve it is
   linked to, the serve auto-map would pick (or a close match staff can
   accept) when it has none, and any modifier list named as a mixer. */
export function buildSquareItemRows(
  copyRows: CatalogItemCopyRow[],
  modifierLists: ModifierListCopyRow[],
  serves: ServeOption[]
): SquareItemRow[] {
  const mixerById = new Map(
    modifierLists
      .filter((list) => isMixerList(list.name))
      .map((list) => {
        const modifiers = list.modifiers ?? [];
        return [
          list.modifier_list_id,
          {
            name: list.name,
            options: modifiers
              .filter((modifier) => modifier.name)
              .map((modifier) => ({ name: modifier.name, price: modifier.price == null ? null : Number(modifier.price) })),
            price: mixerListPrice(modifiers.flatMap((modifier) => (modifier.price == null ? [] : [Number(modifier.price)]))),
          },
        ] as const;
      })
  );

  const serveById = new Map(serves.map((serve) => [serve.menuItemPriceId, serve]));
  const servesOnItem = new Map<string, number>();
  for (const serve of serves) {
    const key = `${serve.categoryId}:${serve.itemName}`;
    servesOnItem.set(key, (servesOnItem.get(key) ?? 0) + 1);
  }
  const linkedServe = new Map<string, number>();
  for (const serve of serves) {
    if (serve.squareVariationId && !linkedServe.has(serve.squareVariationId)) {
      linkedServe.set(serve.squareVariationId, serve.menuItemPriceId);
    }
  }

  const variations: CatalogVariation[] = copyRows.map((row) => ({
    variationId: row.variation_id,
    itemName: row.item_name,
    variationName: row.variation_name,
  }));
  const { targets, taken } = splitLinks(
    serves.map((serve) => ({
      menuItemPriceId: serve.menuItemPriceId,
      itemName: serve.itemName,
      serve: serve.serve,
      servesOnItem: servesOnItem.get(`${serve.categoryId}:${serve.itemName}`) ?? 1,
      squareVariationId: serve.squareVariationId,
    })),
    new Set(variations.map((variation) => variation.variationId))
  );
  const suggested = new Map<string, number>();
  for (const [serveId, variationId] of proposeMappings(variations, targets, taken)) {
    suggested.set(variationId, serveId);
  }
  const proposedServes = new Set(suggested.values());
  const remaining = targets.filter((target) => !proposedServes.has(target.menuItemPriceId));
  const fuzzy = [...suggestMappings(variations, remaining, new Set([...taken, ...suggested.keys()]))].sort(
    (a, b) => b[1].score - a[1].score
  );
  for (const [serveId, suggestion] of fuzzy) {
    if (!suggested.has(suggestion.variationId)) suggested.set(suggestion.variationId, serveId);
  }

  return copyRows
    .map((row) => {
      const linkedServeId = linkedServe.get(row.variation_id) ?? null;
      return {
        variationId: row.variation_id,
        itemId: row.item_id,
        itemName: row.item_name,
        variationName: row.variation_name,
        price: row.price == null ? null : Number(row.price),
        reportingCategory: row.reporting_category_name,
        statusExt: row.status_ext,
        archived: row.is_archived || row.status === "Archived",
        mixers: (row.modifier_list_ids ?? []).flatMap((id) => {
          const mixer = mixerById.get(id);
          return mixer ? [mixer] : [];
        }),
        menuCategoryId: row.menu_category_id == null ? null : Number(row.menu_category_id),
        menuCategoryManual: row.menu_category_manual,
        linkedServeId,
        linkedCategoryId: linkedServeId != null ? (serveById.get(linkedServeId)?.categoryId ?? null) : null,
        suggestedServeId: linkedServeId == null ? (suggested.get(row.variation_id) ?? null) : null,
      };
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName) || a.variationName.localeCompare(b.variationName));
}

const PAGE = 1000;

export async function readCatalogItemCopy(supabase: SupabaseClient): Promise<CatalogItemCopyRow[]> {
  const rows: CatalogItemCopyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("square_catalog_variations")
      .select(
        "variation_id, item_id, item_name, variation_name, price, reporting_category_name, status, status_ext, is_archived, modifier_list_ids, menu_category_id, menu_category_manual"
      )
      .is("deleted_at", null)
      .order("variation_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as CatalogItemCopyRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function readModifierListCopy(supabase: SupabaseClient): Promise<ModifierListCopyRow[]> {
  const { data, error } = await supabase
    .from("square_catalog_modifier_lists")
    .select("modifier_list_id, name, modifiers")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as ModifierListCopyRow[];
}
