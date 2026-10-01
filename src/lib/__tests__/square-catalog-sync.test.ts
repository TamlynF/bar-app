import { describe, expect, it } from "vitest";
import type { Square } from "square";
import { catalogToModifierListRows, catalogToVariationRows, squareStatusLabel } from "../square-catalog-sync";

const LOCATION = "LOC1";
const SYNCED_AT = "2026-10-02T03:00:00.000Z";

const objects = [
  { type: "CATEGORY", id: "CAT_TRACK", categoryData: { name: "TRACKING - Vodka" } },
  { type: "CATEGORY", id: "CAT_VODKA", categoryData: { name: "Vodka" } },
  { type: "CATEGORY", id: "MENU_ROOT", categoryData: { name: "Don Fenticas Hinckley", categoryType: "MENU_CATEGORY" } },
  {
    type: "CATEGORY",
    id: "MENU_SPIRITS",
    categoryData: { name: "Spirits", categoryType: "MENU_CATEGORY", parentCategory: { id: "MENU_ROOT" } },
  },
  {
    type: "CATEGORY",
    id: "MENU_VODKA",
    categoryData: { name: "Vodka", categoryType: "MENU_CATEGORY", parentCategory: { id: "MENU_SPIRITS" } },
  },
  { type: "MODIFIER_LIST", id: "MIXER", modifierListData: { name: "Mixer" } },
  {
    type: "MEASUREMENT_UNIT",
    id: "UNIT_BTL",
    measurementUnitData: { measurementUnit: { customUnit: { name: "Bottle", abbreviation: "Btl" } } },
  },
  {
    type: "ITEM",
    id: "GOOSE",
    updatedAt: "2026-09-30T10:00:00Z",
    itemData: {
      name: "Grey Goose",
      productType: "FOOD_AND_BEV",
      isAlcoholic: true,
      reportingCategory: { id: "CAT_TRACK" },
      categories: [{ id: "CAT_TRACK" }, { id: "CAT_VODKA" }, { id: "MENU_VODKA" }, { id: "MENU_ROOT" }],
      modifierListInfo: [
        { modifierListId: "MIXER", enabled: true },
        { modifierListId: "OLD", enabled: false },
      ],
      variations: [
        {
          type: "ITEM_VARIATION",
          id: "GOOSE_SINGLE",
          updatedAt: "2026-09-29T10:00:00Z",
          itemVariationData: {
            name: "Single",
            sku: "GG1",
            pricingType: "FIXED_PRICING",
            priceMoney: { amount: BigInt(525), currency: "GBP" },
            trackInventory: true,
            locationOverrides: [
              { locationId: LOCATION, trackInventory: false, soldOut: true },
              { locationId: "LOC2", soldOut: true },
            ],
            sellable: true,
            stockable: true,
          },
        },
        {
          type: "ITEM_VARIATION",
          id: "GOOSE_DOUBLE",
          absentAtLocationIds: [LOCATION],
          itemVariationData: {
            name: "Double",
            pricingType: "VARIABLE_PRICING",
            trackInventory: true,
            measurementUnitId: "UNIT_BTL",
          },
        },
      ],
    },
  },
] as unknown as Square.CatalogObject[];

describe("catalogToVariationRows", () => {
  const rows = catalogToVariationRows(objects, LOCATION, SYNCED_AT, {
    locationNames: new Map([[LOCATION, "Don Fenticas"]]),
    stockByVariation: new Map([["GOOSE_DOUBLE", 20]]),
  });

  it("writes one row per variation with the item's details", () => {
    expect(rows.map((row) => row.variation_id)).toEqual(["GOOSE_SINGLE", "GOOSE_DOUBLE"]);
    expect(rows[0]).toMatchObject({
      item_id: "GOOSE",
      item_name: "Grey Goose",
      variation_name: "Single",
      sku: "GG1",
      product_type: "FOOD_AND_BEV",
      price: 5.25,
      currency: "GBP",
      is_alcoholic: true,
      sellable: true,
      item_updated_at: "2026-09-30T10:00:00Z",
      variation_updated_at: "2026-09-29T10:00:00Z",
      synced_at: SYNCED_AT,
      deleted_at: null,
    });
  });

  it("names Square's reporting category and categories from the same listing", () => {
    expect(rows[0]).toMatchObject({
      reporting_category_id: "CAT_TRACK",
      reporting_category_name: "TRACKING - Vodka",
      category_ids: ["CAT_TRACK", "CAT_VODKA"],
      category_names: ["TRACKING - Vodka", "Vodka"],
    });
  });

  it("splits Square's menu categories out from its ordinary categories, named by their full path", () => {
    expect(rows[0].menu_ids).toEqual(["MENU_VODKA", "MENU_ROOT"]);
    expect(rows[0].menu_names).toEqual(["Don Fenticas Hinckley > Spirits > Vodka", "Don Fenticas Hinckley"]);
  });

  it("keeps only the modifier lists switched on for the item", () => {
    expect(rows[0].modifier_list_ids).toEqual(["MIXER"]);
    expect(rows[0].modifier_list_names).toEqual(["Mixer"]);
  });

  it("keeps the variation's own tracking flag apart from what applies at the venue", () => {
    expect(rows[0]).toMatchObject({
      inventory_tracking: true,
      inventory_tracking_location: false,
      stock_tracking: "not_tracked",
    });
    expect(rows[1]).toMatchObject({
      inventory_tracking: true,
      inventory_tracking_location: true,
      stock_tracking: "stock_count",
    });
  });

  it("flags a variation hidden at the venue and leaves a variable price empty", () => {
    expect(rows[0].at_location).toBe(true);
    expect(rows[1]).toMatchObject({ at_location: false, price: null, pricing_type: "VARIABLE_PRICING" });
  });

  it("records where it is sold out, the stock count and the label Square shows", () => {
    expect(rows[0]).toMatchObject({
      sold_out_at: ["Don Fenticas", "LOC2"],
      stock_quantity: null,
      sold_by: null,
      status: "Active",
      status_ext: "Sold out",
    });
    expect(rows[1]).toMatchObject({ sold_out_at: [], stock_quantity: 20, sold_by: "Btl", status_ext: "20 Btl available" });
  });
});

describe("squareStatusLabel", () => {
  it("matches the Status column in Square's item library", () => {
    expect(squareStatusLabel({ soldOut: true, tracked: true, quantity: -9, soldBy: "Btl" })).toBe("Sold out");
    expect(squareStatusLabel({ soldOut: true, tracked: false, quantity: null, soldBy: null })).toBe("Sold out");
    expect(squareStatusLabel({ soldOut: false, tracked: true, quantity: 20, soldBy: "Btl" })).toBe("20 Btl available");
    expect(squareStatusLabel({ soldOut: false, tracked: true, quantity: 2.5, soldBy: null })).toBe("2.5 available");
    expect(squareStatusLabel({ soldOut: false, tracked: true, quantity: 0, soldBy: null })).toBe("Available");
    expect(squareStatusLabel({ soldOut: false, tracked: false, quantity: 5, soldBy: null })).toBe("Available");
  });
});

describe("catalogToModifierListRows", () => {
  it("copies each modifier list with its options in Square's order, prices in pounds", () => {
    const lists = catalogToModifierListRows(
      [
        {
          type: "MODIFIER_LIST",
          id: "MIXER",
          updatedAt: "2026-09-30T10:00:00Z",
          modifierListData: {
            name: "Mixer",
            modifiers: [
              { type: "MODIFIER", id: "NONE", modifierData: { name: "No Mixer" } },
              { type: "MODIFIER", id: "TONIC", modifierData: { name: "Tonic", priceMoney: { amount: BigInt(195), currency: "GBP" } } },
            ],
          },
        },
        { type: "CATEGORY", id: "CAT", categoryData: { name: "Vodka" } },
      ] as unknown as Square.CatalogObject[],
      SYNCED_AT
    );
    expect(lists).toEqual([
      {
        modifier_list_id: "MIXER",
        name: "Mixer",
        modifiers: [
          { id: "NONE", name: "No Mixer", price: null },
          { id: "TONIC", name: "Tonic", price: 1.95 },
        ],
        updated_at: "2026-09-30T10:00:00Z",
        synced_at: SYNCED_AT,
        deleted_at: null,
      },
    ]);
  });
});
