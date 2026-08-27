export type MenuPushPrice = {
  priceId: number;
  serve: string;
  amount: number;
};

export type MenuPushItem = {
  menuItemId: number;
  name: string;
  categoryName: string;
  prices: MenuPushPrice[];
};

export type ExistingCatalog = {
  itemNames: Set<string>;
  categoryIdsByName: Map<string, string>;
};

export type CatalogUpsertPlan = {
  objects: unknown[];
  priceIdByTempVariationId: Map<string, number>;
  createdItemCount: number;
  createdCategoryCount: number;
  skippedItemNames: string[];
};

function pence(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

/* Builds one batchUpsert payload: a CATEGORY per menu category Square doesn't
   know yet, an ITEM per menu item (skipping names already in the catalog so a
   re-run never duplicates), and an ITEM_VARIATION per serve. Client ids are
   "#var-<menu_item_price_id>" so the response's idMappings hand back exactly
   which Square variation belongs to which serve row. */
export function buildCatalogUpsertPlan(
  items: MenuPushItem[],
  existing: ExistingCatalog,
  normaliseName: (value: string) => string
): CatalogUpsertPlan {
  const objects: unknown[] = [];
  const priceIdByTempVariationId = new Map<string, number>();
  const skippedItemNames: string[] = [];

  const categoryTempIds = new Map<string, string>();
  for (const item of items) {
    const key = normaliseName(item.categoryName);
    if (!key || existing.categoryIdsByName.has(key) || categoryTempIds.has(key)) continue;
    const tempId = `#cat-${categoryTempIds.size + 1}`;
    categoryTempIds.set(key, tempId);
    objects.push({
      type: "CATEGORY",
      id: tempId,
      presentAtAllLocations: true,
      categoryData: { name: item.categoryName },
    });
  }

  let createdItemCount = 0;
  for (const item of items) {
    const prices = item.prices.filter((price) => price.amount > 0);
    if (prices.length === 0) continue;
    if (existing.itemNames.has(normaliseName(item.name))) {
      skippedItemNames.push(item.name);
      continue;
    }

    const itemTempId = `#item-${item.menuItemId}`;
    const categoryKey = normaliseName(item.categoryName);
    const categoryId =
      existing.categoryIdsByName.get(categoryKey) ?? categoryTempIds.get(categoryKey);

    const variations = prices.map((price) => {
      const tempId = `#var-${price.priceId}`;
      priceIdByTempVariationId.set(tempId, price.priceId);
      return {
        type: "ITEM_VARIATION",
        id: tempId,
        presentAtAllLocations: true,
        itemVariationData: {
          itemId: itemTempId,
          name: price.serve,
          pricingType: "FIXED_PRICING",
          priceMoney: { amount: pence(price.amount), currency: "GBP" },
        },
      };
    });

    objects.push({
      type: "ITEM",
      id: itemTempId,
      presentAtAllLocations: true,
      itemData: {
        name: item.name,
        ...(categoryId
          ? {
              categories: [{ id: categoryId }],
              reportingCategory: { id: categoryId },
            }
          : {}),
        variations,
      },
    });
    createdItemCount += 1;
  }

  return {
    objects,
    priceIdByTempVariationId,
    createdItemCount,
    createdCategoryCount: categoryTempIds.size,
    skippedItemNames,
  };
}

export type IdMapping = { clientObjectId?: string | null; objectId?: string | null };

/* Turns the batchUpsert response's temp-id → real-id mappings into
   menu_item_price_id → square variation id pairs ready to persist. */
export function variationIdsFromMappings(
  idMappings: IdMapping[],
  priceIdByTempVariationId: Map<string, number>
): Map<number, string> {
  const result = new Map<number, string>();
  for (const mapping of idMappings) {
    if (!mapping.clientObjectId || !mapping.objectId) continue;
    const priceId = priceIdByTempVariationId.get(mapping.clientObjectId);
    if (priceId !== undefined) result.set(priceId, mapping.objectId);
  }
  return result;
}
