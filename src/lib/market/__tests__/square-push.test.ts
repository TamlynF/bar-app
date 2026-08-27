import { describe, expect, it } from "vitest";
import { normaliseName } from "@/lib/menu-import";
import {
  buildCatalogUpsertPlan,
  variationIdsFromMappings,
  type ExistingCatalog,
  type MenuPushItem,
} from "../square-push";

const items: MenuPushItem[] = [
  {
    menuItemId: 1,
    name: "Hawkstone Premium Lager",
    categoryName: "Draught",
    prices: [
      { priceId: 10, serve: "pint", amount: 5.5 },
      { priceId: 11, serve: "half pint", amount: 3.25 },
    ],
  },
  {
    menuItemId: 2,
    name: "Guinness",
    categoryName: "Draught",
    prices: [
      { priceId: 12, serve: "pint", amount: 4.95 },
      { priceId: 13, serve: "half pint", amount: 2.95 },
    ],
  },
  {
    menuItemId: 3,
    name: "Aperol Spritz",
    categoryName: "Classic Cocktails",
    prices: [{ priceId: 14, serve: "each", amount: 8.95 }],
  },
];

const empty: ExistingCatalog = { itemNames: new Set(), categoryIdsByName: new Map() };

type ItemObject = {
  type: string;
  id: string;
  itemData: {
    name: string;
    categories?: { id: string }[];
    reportingCategory?: { id: string };
    variations: {
      id: string;
      itemVariationData: { itemId: string; name: string; priceMoney: { amount: bigint } };
    }[];
  };
};

describe("buildCatalogUpsertPlan", () => {
  it("creates a category per new menu category and links items to it", () => {
    const plan = buildCatalogUpsertPlan(items, empty, normaliseName);
    const categories = plan.objects.filter((o) => (o as { type: string }).type === "CATEGORY");
    expect(categories).toHaveLength(2);
    expect(plan.createdCategoryCount).toBe(2);
    const lager = plan.objects.find(
      (o) => (o as ItemObject).itemData?.name === "Hawkstone Premium Lager"
    ) as ItemObject;
    expect(lager.itemData.categories?.[0].id).toMatch(/^#cat-/);
    expect(lager.itemData.reportingCategory?.id).toBe(lager.itemData.categories?.[0].id);
  });

  it("creates a variation per serve with pence amounts and traceable temp ids", () => {
    const plan = buildCatalogUpsertPlan(items, empty, normaliseName);
    const lager = plan.objects.find(
      (o) => (o as ItemObject).itemData?.name === "Hawkstone Premium Lager"
    ) as ItemObject;
    expect(lager.itemData.variations).toHaveLength(2);
    const pint = lager.itemData.variations[0];
    expect(pint.id).toBe("#var-10");
    expect(pint.itemVariationData.itemId).toBe("#item-1");
    expect(pint.itemVariationData.name).toBe("pint");
    expect(pint.itemVariationData.priceMoney.amount).toBe(550n);
    expect(plan.priceIdByTempVariationId.get("#var-11")).toBe(11);
  });

  it("skips items whose name already exists in the Square catalog", () => {
    const existing: ExistingCatalog = {
      itemNames: new Set([normaliseName("guinness")]),
      categoryIdsByName: new Map(),
    };
    const plan = buildCatalogUpsertPlan(items, existing, normaliseName);
    expect(plan.skippedItemNames).toEqual(["Guinness"]);
    expect(plan.createdItemCount).toBe(2);
  });

  it("reuses existing Square categories instead of recreating them", () => {
    const existing: ExistingCatalog = {
      itemNames: new Set(),
      categoryIdsByName: new Map([[normaliseName("Draught"), "REAL_CAT"]]),
    };
    const plan = buildCatalogUpsertPlan(items, existing, normaliseName);
    expect(plan.createdCategoryCount).toBe(1);
    const lager = plan.objects.find(
      (o) => (o as ItemObject).itemData?.name === "Hawkstone Premium Lager"
    ) as ItemObject;
    expect(lager.itemData.categories?.[0].id).toBe("REAL_CAT");
  });

  it("drops items with no positive price", () => {
    const freeTapWater: MenuPushItem = {
      menuItemId: 99,
      name: "Tap Water",
      categoryName: "Soft Drinks",
      prices: [{ priceId: 90, serve: "each", amount: 0 }],
    };
    const plan = buildCatalogUpsertPlan([...items, freeTapWater], empty, normaliseName);
    expect(
      plan.objects.some((o) => (o as ItemObject).itemData?.name === "Tap Water")
    ).toBe(false);
  });
});

describe("variationIdsFromMappings", () => {
  it("maps temp variation ids back to price rows and ignores the rest", () => {
    const plan = buildCatalogUpsertPlan(items, empty, normaliseName);
    const result = variationIdsFromMappings(
      [
        { clientObjectId: "#var-10", objectId: "SQ_VAR_A" },
        { clientObjectId: "#item-1", objectId: "SQ_ITEM" },
        { clientObjectId: null, objectId: "X" },
      ],
      plan.priceIdByTempVariationId
    );
    expect(result.get(10)).toBe("SQ_VAR_A");
    expect(result.size).toBe(1);
  });
});
