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

/* A Square variation is "item + variation name" ("Neck Oil" / "Pint"); a menu
   serve is "item + serve" ("Neck Oil" / "pint"). Names must agree; the serve
   only has to agree when either side actually distinguishes serves - an item
   sold one way matches its only variation even if Square calls it "Regular". */
export function proposeMappings(
  variations: CatalogVariation[],
  targets: MappingTarget[]
): Map<number, string> {
  const variationsByItem = new Map<string, CatalogVariation[]>();
  for (const variation of variations) {
    const key = normaliseName(variation.itemName);
    const list = variationsByItem.get(key) ?? [];
    list.push(variation);
    variationsByItem.set(key, list);
  }

  const proposals = new Map<number, string>();
  for (const target of targets) {
    const candidates = variationsByItem.get(normaliseName(target.itemName)) ?? [];
    if (candidates.length === 0) continue;

    const serveMatch = candidates.find(
      (candidate) => normalizeServe(candidate.variationName) === target.serve
    );
    if (serveMatch) {
      proposals.set(target.menuItemPriceId, serveMatch.variationId);
      continue;
    }

    if (target.servesOnItem === 1 && candidates.length === 1) {
      proposals.set(target.menuItemPriceId, candidates[0].variationId);
    }
  }
  return proposals;
}
