/* Spirits sold with a mixer: the till rings the spirit's variation plus a
   modifier from the venue's Mixer modifier list. The market only moves the
   spirit price; the customer pays spirit + mixer, so every public screen
   shows that total. */

export type SquareModifierList = {
  id: string;
  name: string;
  modifierPrices: number[];
  modifierIds?: string[];
};

/* Which Square modifier list is the mixer, set on Settings → Market →
   Square links. "list" pins one list whatever it is called; "auto" takes any
   list with "mixer" in its name; "off" ignores Square and leaves only the
   serves staff tick. */
export type MixerChoice =
  | { mode: "auto" }
  | { mode: "list"; listId: string; listName: string | null }
  | { mode: "off" };

export const DEFAULT_MIXER_CHOICE: MixerChoice = { mode: "auto" };

export function mixerChoiceFromRow(
  row: { mixer_mode?: string | null; mixer_modifier_list_id?: string | null; mixer_modifier_list_name?: string | null } | null
): MixerChoice {
  if (row?.mixer_mode === "off") return { mode: "off" };
  if (row?.mixer_mode === "list" && row.mixer_modifier_list_id) {
    return { mode: "list", listId: row.mixer_modifier_list_id, listName: row.mixer_modifier_list_name ?? null };
  }
  return DEFAULT_MIXER_CHOICE;
}

export function isMixerList(list: Pick<SquareModifierList, "id" | "name">, choice: MixerChoice): boolean {
  if (choice.mode === "off") return false;
  if (choice.mode === "list") return list.id === choice.listId;
  return isMixerListName(list.name);
}

export type ServeMixerSource = {
  withMixer: boolean;
  squareMixerListIds: string[];
};

export function isMixerListName(name: string | null | undefined): boolean {
  return /\bmixers?\b/i.test(name ?? "");
}

/* A Mixer list prices every option the same in practice; if a few differ the
   most common price is the one the board can honestly quote. */
export function mixerListPrice(modifierPrices: number[]): number | null {
  const counts = new Map<number, number>();
  for (const price of modifierPrices) {
    if (!Number.isFinite(price) || price < 0) continue;
    const pence = Math.round(price * 100);
    counts.set(pence, (counts.get(pence) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [pence, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && pence < best)) {
      best = pence;
      bestCount = count;
    }
  }
  return best === null ? null : best / 100;
}

/* Square wins when the item carries a Mixer modifier list, because that is
   what the till adds; otherwise a staff-flagged serve uses the event's
   mixer price. Null means the drink is sold on its own. */
/* The chosen mixer list on an item, for ringing a test sale with a mixer. */
export function squareMixerList(
  listIds: string[],
  mixerLists: Map<string, SquareModifierList>,
  choice: MixerChoice = DEFAULT_MIXER_CHOICE
): SquareModifierList | null {
  for (const listId of listIds) {
    const list = mixerLists.get(listId);
    if (list && isMixerList(list, choice)) return list;
  }
  return null;
}

export function squareMixerPrice(
  listIds: string[],
  mixerLists: Map<string, SquareModifierList>,
  choice: MixerChoice = DEFAULT_MIXER_CHOICE
): number | null {
  for (const listId of listIds) {
    const list = mixerLists.get(listId);
    if (!list || !isMixerList(list, choice)) continue;
    const price = mixerListPrice(list.modifierPrices);
    if (price !== null) return price;
  }
  return null;
}

export function resolveMixerPrice(
  source: ServeMixerSource,
  mixerLists: Map<string, SquareModifierList>,
  fallbackPrice: number,
  choice: MixerChoice = DEFAULT_MIXER_CHOICE
): number | null {
  return squareMixerPrice(source.squareMixerListIds, mixerLists, choice) ?? (source.withMixer ? fallbackPrice : null);
}

/* The mixer a serve will carry on the board: Square's price when the item
   has the chosen mixer list, otherwise the event's price for a ticked serve. */
export function serveMixerPrice(
  serve: { squareMixerPrice?: number | null; withMixer?: boolean },
  eventMixerPrice: number
): number | null {
  return serve.squareMixerPrice ?? (serve.withMixer ? eventMixerPrice : null);
}

export function withMixer(price: number, mixerPrice: number | null | undefined): number {
  return Math.round((price + (mixerPrice ?? 0)) * 100) / 100;
}

export function withMixerOrNull(price: number | null, mixerPrice: number | null | undefined): number | null {
  return price === null ? null : withMixer(price, mixerPrice);
}

export function servedChangePct(from: number, to: number, mixerPrice: number | null | undefined): number {
  const servedFrom = withMixer(from, mixerPrice);
  if (servedFrom <= 0) return 0;
  return Math.round(((withMixer(to, mixerPrice) - servedFrom) / servedFrom) * 1000) / 10;
}

export function mixerServeLabel(serve: string, mixerPrice: number | null | undefined): string {
  if (mixerPrice == null) return serve;
  const trimmed = serve.trim();
  return trimmed && trimmed.toLowerCase() !== "each" ? `${trimmed} + mixer` : "with mixer";
}

type PriceEventPayload = {
  serve?: string | null;
  from?: number | null;
  to?: number | null;
  pct?: number | null;
};

const PRICE_MOVE_KINDS = new Set(["price_drop", "surge"]);
const TIER_KINDS = new Set(["tier_up", "tier_down"]);

/* Price alerts are stored on the spirit price; what the public reads (ticker,
   phone pushes) is the served price, so the move and its % are restated on
   spirit + mixer. A tier event's % is the spirit's move from its base, so it
   is scaled to the same move on base + mixer - the figure the board's pill
   shows. The tier fractions in from/to stay as they are. */
export function servedEventPayload<T extends PriceEventPayload>(
  kind: string,
  payload: T,
  mixerPrice: number | null | undefined,
  spiritBase?: number | null
): T {
  if (mixerPrice == null) return payload;
  const served: T = {
    ...payload,
    ...(payload.serve != null ? { serve: mixerServeLabel(payload.serve, mixerPrice) } : {}),
  };
  if (PRICE_MOVE_KINDS.has(kind) && typeof payload.from === "number" && typeof payload.to === "number") {
    served.from = withMixer(payload.from, mixerPrice);
    served.to = withMixer(payload.to, mixerPrice);
    served.pct = servedChangePct(payload.from, payload.to, mixerPrice);
  }
  if (TIER_KINDS.has(kind) && typeof payload.pct === "number" && spiritBase != null && spiritBase > 0) {
    served.pct = Math.round(((payload.pct * spiritBase) / withMixer(spiritBase, mixerPrice)) * 10) / 10;
  }
  return served;
}
