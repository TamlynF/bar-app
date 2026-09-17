import { unstable_cache } from "next/cache";
import { squareClient } from "@/lib/square";

/* The market table links each drink to its item in the Square dashboard, which
   addresses items by their parent ITEM id. Instruments only carry the
   ITEM_VARIATION id from the menu mapping, so the parent has to come from the
   catalog.

   Looking it up per click cost a Square call every time and forced the link to
   be a button. One pass over the catalog builds the whole map instead, cached
   for an hour, so the page can render real anchors. A mapping saved since the
   last pass simply misses, and the caller falls back to resolving on click. */

const CACHE_KEY = ["market", "square-variation-item-map"];
const CACHE_TTL_SECONDS = 3600;

export const SQUARE_ITEM_MAP_TAG = "square-item-map";

async function fetchVariationItemPairs(): Promise<[string, string][]> {
  const pairs: [string, string][] = [];
  const page = await squareClient.catalog.list({ types: "ITEM" });
  for await (const obj of page) {
    if (obj.type !== "ITEM" || !obj.id) continue;
    for (const variation of obj.itemData?.variations ?? []) {
      if (variation.type !== "ITEM_VARIATION" || !variation.id) continue;
      pairs.push([variation.id, obj.id]);
    }
  }
  return pairs;
}

const cachedPairs = unstable_cache(fetchVariationItemPairs, CACHE_KEY, {
  revalidate: CACHE_TTL_SECONDS,
  tags: [SQUARE_ITEM_MAP_TAG],
});

/* Never throws: an unreachable Square costs the anchors, not the page. */
export async function squareItemIdsByVariation(): Promise<Map<string, string>> {
  try {
    return new Map(await cachedPairs());
  } catch (err) {
    console.error("[market] square item map lookup failed:", err);
    return new Map();
  }
}
