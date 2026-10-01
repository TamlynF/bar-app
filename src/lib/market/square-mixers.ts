import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MIXER_CHOICE, mixerChoiceFromRow, squareMixerList, squareMixerPrice, type MixerChoice } from "./mixer";
import { readMixerInfo, type MixerInfo } from "./catalog-copy";
import { resolveMarketConfig } from "./types";

/* Works out which drinks the till sells with a Mixer modifier and what that
   modifier costs, so the board can quote spirit + mixer exactly as the till
   rings it. Read from the catalog copy (square_catalog_variations and
   square_catalog_modifier_lists); the market never writes the mixer. */

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

type MixerInstrumentRow = {
  id: number;
  menu_item_price_id: number;
  square_variation_id: string | null;
  mixer_price: number | string | null;
};

/* Sets every instrument's mixer price for the session. The chosen mixer
   modifier list on the item, as the catalog copy has it, decides; a
   staff-ticked serve Square does not mark uses the event's mixer price.
   Square's answer is never copied onto the menu, so choosing a different
   list takes effect everywhere at once. Refresh the copy first when the
   answer must be current (opening, the catalog webhook). */
export async function refreshSessionMixers(supabase: SupabaseClient, sessionId: number): Promise<number> {
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

  const info: MixerInfo =
    choice.mode === "off"
      ? { listIdsByVariation: new Map(), lists: new Map() }
      : await readMixerInfo(
          supabase,
          instruments.flatMap((row) => (row.square_variation_id ? [row.square_variation_id] : []))
        );

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
   A copy that cannot be read just leaves the staff ticks to show. */
export async function withSquareMixers<T extends { squareVariationId: string | null; squareMixerPrice: number | null }>(
  supabase: SupabaseClient,
  serves: T[]
): Promise<T[]> {
  const choice = await readMixerChoice(supabase);
  if (choice.mode === "off") return serves;
  const ids = [...new Set(serves.map((serve) => serve.squareVariationId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return serves;
  try {
    const info = await readMixerInfo(supabase, ids);
    return serves.map((serve) => {
      if (!serve.squareVariationId) return serve;
      const price = squareMixerPrice(info.listIdsByVariation.get(serve.squareVariationId) ?? [], info.lists, choice);
      return price === null ? serve : { ...serve, squareMixerPrice: price };
    });
  } catch (err) {
    console.error("[market] could not read mixers for the drink picker:", err);
    return serves;
  }
}

/* For each variation whose item carries the chosen mixer list, that list's
   modifier ids - the sandbox rings a test sale with one of them so a
   "Grey Goose single + Tonic" order goes through Square like the till's.
   Empty when the copy cannot be read: the sale is then rung without a mixer. */
export async function mixerModifierIdsByVariation(
  supabase: SupabaseClient,
  variationIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const choice = await readMixerChoice(supabase);
  if (choice.mode === "off" || variationIds.length === 0) return result;
  try {
    const info = await readMixerInfo(supabase, variationIds);
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
