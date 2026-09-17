import { squareClient } from "@/lib/square";
import type { CatalogVariation } from "./mapping";

export async function fetchCatalogVariations(): Promise<CatalogVariation[]> {
  const variations: CatalogVariation[] = [];
  const page = await squareClient.catalog.list({ types: "ITEM" });
  for await (const obj of page) {
    if (obj.type !== "ITEM" || !obj.itemData?.name) continue;
    for (const variation of obj.itemData.variations ?? []) {
      if (variation.type !== "ITEM_VARIATION" || !variation.id) continue;
      variations.push({
        variationId: variation.id,
        itemName: obj.itemData.name,
        variationName: variation.itemVariationData?.name ?? "",
      });
    }
  }
  return variations;
}
