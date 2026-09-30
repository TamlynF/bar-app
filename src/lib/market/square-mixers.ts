import type { SupabaseClient } from "@supabase/supabase-js";
import type { Square } from "square";
import { squareClient } from "@/lib/square";
import {
  DEFAULT_MIXER_CHOICE,
  mixerChoiceFromRow,
  mixerListPrice,
  squareMixerList,
  squareMixerPrice,
  type MixerChoice,
  type SquareModifierList,
} from "./mixer";
import { resolveMarketConfig } from "./types";

/* Reads which live drinks the till sells with a Mixer modifier and what that
   modifier costs, so the board can quote spirit + mixer exactly as the till
   rings it. Read-only against Square: the market never writes the mixer. */

type SquareMixerInfo = {
  listIdsByVariation: Map<string, string[]>;
  lists: Map<string, SquareModifierList>;
};

const BATCH_GET_LIMIT = 1000;

function moneyToPounds(money: Square.Money | undefined | null): number | null {
  return money?.amount == null ? null : Number(money.amount) / 100;
}

async function batchGet(ids: string[], includeRelatedObjects: boolean) {
  const objects: Square.CatalogObject[] = [];
  const related: Square.CatalogObject[] = [];
  for (let i = 0; i < ids.length; i += BATCH_GET_LIMIT) {
    const res = await squareClient.catalog.batchGet({
      objectIds: ids.slice(i, i + BATCH_GET_LIMIT),
      includeRelatedObjects,
      includeDeletedObjects: false,
    });
    objects.push(...(res.objects ?? []));
    related.push(...(res.relatedObjects ?? []));
  }
  return { objects, related };
}

function modifierList(obj: Square.CatalogObject): SquareModifierList | null {
  if (obj.type !== "MODIFIER_LIST" || !obj.id) return null;
  const data = obj.modifierListData;
  return {
    id: obj.id,
    name: data?.name ?? "",
    modifierPrices: (data?.modifiers ?? []).flatMap((modifier) => {
      if (modifier.type !== "MODIFIER") return [];
      const price = moneyToPounds(modifier.modifierData?.priceMoney);
      return price === null ? [] : [price];
    }),
    modifierIds: (data?.modifiers ?? []).flatMap((modifier) =>
      modifier.type === "MODIFIER" && modifier.id ? [modifier.id] : []
    ),
  };
}

export async function readMixerChoice(supabase: SupabaseClient): Promise<MixerChoice> {
  const { data, error } = await supabase
    .from("market_settings")
    .select("mixer_mode, mixer_modifier_list_id, mixer_modifier_list_name")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("[market] could not read the mixer setting, using auto:", error);
    return DEFAULT_MIXER_CHOICE;
  }
  return mixerChoiceFromRow(data);
}

export type ModifierListOption = {
  id: string;
  name: string;
  modifierNames: string[];
  price: number | null;
  mixedPrices: boolean;
  itemNames: string[];
};

/* Every modifier list in the Square catalog with what it offers and which
   items carry it, for the settings page to choose the mixer from. */
export async function fetchModifierListOptions(): Promise<ModifierListOption[]> {
  const lists = new Map<string, ModifierListOption>();
  const itemNamesByList = new Map<string, string[]>();
  const page = await squareClient.catalog.list({ types: "ITEM,MODIFIER_LIST" });
  for await (const obj of page) {
    if (obj.type === "MODIFIER_LIST" && obj.id) {
      const list = modifierList(obj);
      lists.set(obj.id, {
        id: obj.id,
        name: list?.name || "Untitled modifier list",
        modifierNames: (obj.modifierListData?.modifiers ?? []).flatMap((modifier) =>
          modifier.type === "MODIFIER" && modifier.modifierData?.name ? [modifier.modifierData.name] : []
        ),
        price: mixerListPrice(list?.modifierPrices ?? []),
        mixedPrices: new Set((list?.modifierPrices ?? []).map((price) => Math.round(price * 100))).size > 1,
        itemNames: [],
      });
    } else if (obj.type === "ITEM" && obj.itemData?.name) {
      for (const info of obj.itemData.modifierListInfo ?? []) {
        if (info.enabled === false || !info.modifierListId) continue;
        const names = itemNamesByList.get(info.modifierListId) ?? [];
        names.push(obj.itemData.name);
        itemNamesByList.set(info.modifierListId, names);
      }
    }
  }
  return [...lists.values()]
    .map((list) => ({ ...list, itemNames: (itemNamesByList.get(list.id) ?? []).sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSquareMixerInfo(variationIds: string[]): Promise<SquareMixerInfo> {
  const listIdsByVariation = new Map<string, string[]>();
  const lists = new Map<string, SquareModifierList>();
  if (variationIds.length === 0) return { listIdsByVariation, lists };

  const { objects: variations } = await batchGet(variationIds, false);
  const itemIdByVariation = new Map<string, string>();
  for (const obj of variations) {
    if (obj.type !== "ITEM_VARIATION" || !obj.id || !obj.itemVariationData?.itemId) continue;
    itemIdByVariation.set(obj.id, obj.itemVariationData.itemId);
  }
  const itemIds = [...new Set(itemIdByVariation.values())];
  if (itemIds.length === 0) return { listIdsByVariation, lists };

  const { objects: items, related } = await batchGet(itemIds, true);
  for (const obj of related) {
    const list = modifierList(obj);
    if (list) lists.set(list.id, list);
  }
  const listIdsByItem = new Map<string, string[]>();
  for (const obj of items) {
    if (obj.type !== "ITEM" || !obj.id) continue;
    const enabled = (obj.itemData?.modifierListInfo ?? [])
      .filter((info) => info.enabled !== false && info.modifierListId)
      .map((info) => info.modifierListId as string);
    listIdsByItem.set(obj.id, enabled);
  }
  for (const [variationId, itemId] of itemIdByVariation) {
    listIdsByVariation.set(variationId, listIdsByItem.get(itemId) ?? []);
  }
  return { listIdsByVariation, lists };
}

type MixerInstrumentRow = {
  id: number;
  menu_item_price_id: number;
  square_variation_id: string | null;
  mixer_price: number | string | null;
};

/* Sets every instrument's mixer price for the session. With Square reachable
   the chosen mixer modifier list on the item decides; a staff-ticked serve
   Square does not mark uses the event's mixer price. Square's answer is
   never copied onto the menu, so choosing a different list takes effect
   everywhere at once. When Square is unreachable only the staff ticks apply
   on open, and a refresh (webhook) leaves prices alone. */
export async function refreshSessionMixers(
  supabase: SupabaseClient,
  sessionId: number,
  options: { requireSquare: boolean }
): Promise<number> {
  const [{ data: session }, { data: rows, error }] = await Promise.all([
    supabase.from("market_sessions").select("config").eq("id", sessionId).maybeSingle(),
    supabase
      .from("market_instruments")
      .select("id, menu_item_price_id, square_variation_id, mixer_price")
      .eq("session_id", sessionId),
  ]);
  if (error) throw error;
  const instruments = (rows ?? []) as MixerInstrumentRow[];
  if (instruments.length === 0) return 0;
  const config = resolveMarketConfig(session?.config);
  const choice = await readMixerChoice(supabase);

  const { data: serves, error: serveError } = await supabase
    .from("menu_item_prices")
    .select("id, with_mixer")
    .in(
      "id",
      instruments.map((row) => row.menu_item_price_id)
    );
  if (serveError) throw serveError;
  const flagged = new Set(
    ((serves ?? []) as { id: number; with_mixer: boolean | null }[]).filter((s) => s.with_mixer).map((s) => s.id)
  );

  let info: SquareMixerInfo = { listIdsByVariation: new Map(), lists: new Map() };
  if (choice.mode !== "off") {
    try {
      info = await fetchSquareMixerInfo(
        [...new Set(instruments.map((row) => row.square_variation_id).filter((id): id is string => Boolean(id)))]
      );
    } catch (err) {
      if (options.requireSquare) throw err;
      console.error("[market] could not read Square mixers, using staff flags only:", err);
    }
  }

  const updates = instruments.flatMap((row) => {
    const listIds = row.square_variation_id ? (info.listIdsByVariation.get(row.square_variation_id) ?? []) : [];
    const fromSquare = squareMixerPrice(listIds, info.lists, choice);
    const price = fromSquare ?? (flagged.has(row.menu_item_price_id) ? config.mixerPrice : null);
    const current = row.mixer_price == null ? null : Number(row.mixer_price);
    return current === price ? [] : [{ id: row.id, price }];
  });

  await Promise.all(
    updates.map(async (update) => {
      const { error: updateError } = await supabase
        .from("market_instruments")
        .update({ mixer_price: update.price })
        .eq("id", update.id);
      if (updateError) console.error("[market] mixer price write failed:", updateError);
    })
  );
  return updates.length;
}

/* Fills in squareMixerPrice on menu serves for the admin pickers, so a spirit
   the till sells with a mixer is quoted as spirit + mixer before it trades.
   Square being unreachable just leaves the staff ticks to show. */
export async function withSquareMixers<T extends { squareVariationId: string | null; squareMixerPrice: number | null }>(
  supabase: SupabaseClient,
  serves: T[]
): Promise<T[]> {
  const choice = await readMixerChoice(supabase);
  if (choice.mode === "off") return serves;
  const ids = [...new Set(serves.map((serve) => serve.squareVariationId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return serves;
  try {
    const info = await fetchSquareMixerInfo(ids);
    return serves.map((serve) => {
      if (!serve.squareVariationId) return serve;
      const price = squareMixerPrice(info.listIdsByVariation.get(serve.squareVariationId) ?? [], info.lists, choice);
      return price === null ? serve : { ...serve, squareMixerPrice: price };
    });
  } catch (err) {
    console.error("[market] could not read Square mixers for the drink picker:", err);
    return serves;
  }
}

/* For each variation whose item carries the chosen mixer list, that list's
   modifier ids - the sandbox rings a test sale with one of them so a
   "Grey Goose single + Tonic" order goes through Square like the till's.
   Empty when Square cannot be read: the sale is then rung without a mixer. */
export async function mixerModifierIdsByVariation(
  supabase: SupabaseClient,
  variationIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const choice = await readMixerChoice(supabase);
  if (choice.mode === "off" || variationIds.length === 0) return result;
  try {
    const info = await fetchSquareMixerInfo([...new Set(variationIds)]);
    for (const [variationId, listIds] of info.listIdsByVariation) {
      const ids = squareMixerList(listIds, info.lists, choice)?.modifierIds ?? [];
      if (ids.length > 0) result.set(variationId, ids);
    }
  } catch (err) {
    console.error("[market] could not read mixers for the test sale:", err);
  }
  return result;
}

export function pickMixerModifier(ids: string[] | undefined, random: () => number = Math.random): string | null {
  if (!ids || ids.length === 0) return null;
  return ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
}
