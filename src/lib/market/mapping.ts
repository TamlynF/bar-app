import { normaliseName } from "@/lib/menu-import";
import { normalizeServe } from "@/lib/menu-price";

export type CatalogVariation = {
  variationId: string;
  itemName: string;
  variationName: string;
};

export type MappingTarget = {
  menuItemPriceId: number;
  itemName: string;
  serve: string;
  servesOnItem: number;
};

/* Menu names carry sizes and flavour notes Square leaves off ("Peroni 330ml",
   "Wundersauce (Tropical)") and apostrophes it drops ("Bailey's"). */
export function looseName(value: string): string {
  return normaliseName(
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/['’]/g, "")
      .replace(/\b\d+(?:\.\d+)?\s*(?:ml|cl|l)\b/gi, " ")
  );
}

const SERVE_WORDS = new Set(["regular", "each", "shot", "tray", "pint", "half", "single", "double", "glass", "bottle", "small", "large"]);

function nameTokens(value: string): string[] {
  return looseName(value)
    .split(" ")
    .filter((token) => token && token !== "and" && !SERVE_WORDS.has(token))
    .map((token) => (token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token));
}

function groupBy(variations: CatalogVariation[], key: (variation: CatalogVariation) => string) {
  const out = new Map<string, CatalogVariation[]>();
  for (const variation of variations) {
    const value = key(variation);
    if (!value) continue;
    const list = out.get(value) ?? [];
    list.push(variation);
    out.set(value, list);
  }
  return out;
}

const SINGLE_UNIT = new Set(["regular", "shot"]);

/* A serve sold "each" is one unit, which Square calls "Regular" or "Shot"
   beside its trays and doubles. */
function pickByServe(candidates: CatalogVariation[], target: MappingTarget): CatalogVariation | null {
  const serveMatch = candidates.find((candidate) => normalizeServe(candidate.variationName) === target.serve);
  if (serveMatch) return serveMatch;
  if (target.servesOnItem === 1 && candidates.length === 1) return candidates[0];
  if (target.serve === "each") {
    const units = candidates.filter((candidate) => SINGLE_UNIT.has(normaliseName(candidate.variationName)));
    if (units.length === 1) return units[0];
  }
  return null;
}

function serveConflicts(candidate: CatalogVariation, target: MappingTarget): boolean {
  const serve = normalizeServe(candidate.variationName);
  return serve != null && serve !== "each" && target.serve !== "each" && serve !== target.serve;
}

/* A Square variation is "item + variation name" ("Neck Oil" / "Pint"); a menu
   serve is "item + serve" ("Neck Oil" / "pint"). Names must agree; the serve
   only has to agree when either side actually distinguishes serves - an item
   sold one way matches its only variation even if Square calls it "Regular".
   When the item names differ, the flavour may sit in Square's variation
   ("Breezer" / "Orange", "Mojito" / "Strawberry Mojito"), which only counts
   when exactly one variation fits. Variations in taken are already linked
   elsewhere and never proposed twice. */
export function proposeMappings(
  variations: CatalogVariation[],
  targets: MappingTarget[],
  taken: Set<string> = new Set()
): Map<number, string> {
  const free = variations.filter((variation) => !taken.has(variation.variationId));
  const tiers: { byKey: Map<string, CatalogVariation[]>; key: (name: string) => string; byServe: boolean }[] = [
    { byKey: groupBy(free, (v) => normaliseName(v.itemName)), key: normaliseName, byServe: true },
    { byKey: groupBy(free, (v) => looseName(v.itemName)), key: looseName, byServe: true },
    { byKey: groupBy(free, (v) => looseName(v.variationName)), key: looseName, byServe: false },
    { byKey: groupBy(free, (v) => looseName(`${v.itemName} ${v.variationName}`)), key: looseName, byServe: false },
    { byKey: groupBy(free, (v) => looseName(`${v.variationName} ${v.itemName}`)), key: looseName, byServe: false },
  ];

  const used = new Set<string>();
  const proposals = new Map<number, string>();
  for (const target of targets) {
    for (const tier of tiers) {
      const candidates = (tier.byKey.get(tier.key(target.itemName)) ?? []).filter(
        (candidate) => !used.has(candidate.variationId) && (tier.byServe || !serveConflicts(candidate, target))
      );
      if (candidates.length === 0) continue;
      const pick = tier.byServe ? pickByServe(candidates, target) : candidates.length === 1 ? candidates[0] : null;
      if (!pick) continue;
      proposals.set(target.menuItemPriceId, pick.variationId);
      used.add(pick.variationId);
      break;
    }
  }
  return proposals;
}

export type MenuServeLink = MappingTarget & { squareVariationId: string | null };

/* Serves still to match: unlinked ones, and ones linked to a variation that
   is not in the catalog (a sandbox id after moving to the live account, or
   an item deleted in Square). Every other link is kept and its variation is
   taken. */
export function splitLinks(serves: MenuServeLink[], knownVariationIds: Set<string>) {
  const targets: MappingTarget[] = [];
  const taken = new Set<string>();
  for (const serve of serves) {
    if (serve.squareVariationId && knownVariationIds.has(serve.squareVariationId)) {
      taken.add(serve.squareVariationId);
    } else {
      targets.push({
        menuItemPriceId: serve.menuItemPriceId,
        itemName: serve.itemName,
        serve: serve.serve,
        servesOnItem: serve.servesOnItem,
      });
    }
  }
  return { targets, taken };
}

export type MappingSuggestion ={ variationId: string; score: number };

const SUGGESTION_THRESHOLD = 0.5;

function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const right = new Set(b);
  const shared = new Set(a.filter((token) => right.has(token))).size;
  return (2 * shared) / (new Set(a).size + right.size);
}

/* Close name matches for staff to accept or ignore, never saved on their
   own: the Square item sharing most words with the menu name ("Whitley Neill
   Rhubarb & Ginger" against "Whitley Neill Rhubarb"), as long as one item
   clearly wins and its serves line up. A menu name found whole in several
   Square items ("Tonic" in "Tonic Full Fat" and "Tonic Slimline") is left
   for staff to pick. */
export function suggestMappings(
  variations: CatalogVariation[],
  targets: MappingTarget[],
  taken: Set<string> = new Set()
): Map<number, MappingSuggestion> {
  const byItem = groupBy(
    variations.filter((variation) => !taken.has(variation.variationId)),
    (variation) => normaliseName(variation.itemName)
  );
  const items = [...byItem.values()].map((list) => ({
    list,
    tokens: nameTokens(list[0].itemName),
    compact: looseName(list[0].itemName).replace(/ /g, ""),
  }));

  const suggestions = new Map<number, MappingSuggestion>();
  for (const target of targets) {
    const tokens = nameTokens(target.itemName);
    const compact = looseName(target.itemName).replace(/ /g, "");
    const containing = items.filter((item) => tokens.length > 0 && tokens.every((token) => item.tokens.includes(token)));
    if (containing.length > 1) continue;
    let best = 0;
    let winners: CatalogVariation[][] = [];
    for (const item of items) {
      const score = compact && item.compact === compact ? 1 : similarity(tokens, item.tokens);
      if (score > best) {
        best = score;
        winners = [item.list];
      } else if (score === best && score > 0) {
        winners.push(item.list);
      }
    }
    if (best < SUGGESTION_THRESHOLD || winners.length !== 1) continue;
    const pick = pickByServe(winners[0], target);
    if (pick) suggestions.set(target.menuItemPriceId, { variationId: pick.variationId, score: best });
  }
  return suggestions;
}
