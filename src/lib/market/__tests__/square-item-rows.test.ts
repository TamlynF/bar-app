import { describe, expect, it } from "vitest";
import {
  buildSquareItemRows,
  hiddenServeLabel,
  isMixerList,
  serveOptionsFrom,
  type CatalogItemCopyRow,
  type ServeCategoryRow,
} from "../square-item-rows";

function copyRow(overrides: Partial<CatalogItemCopyRow>): CatalogItemCopyRow {
  return {
    variation_id: "V",
    item_id: "I",
    item_name: "",
    variation_name: "Regular",
    price: "4.50",
    reporting_category_name: null,
    status: "Active",
    status_ext: "Available",
    is_archived: false,
    modifier_list_ids: [],
    menu_category_id: null,
    menu_category_manual: false,
    ...overrides,
  };
}

const categories: ServeCategoryRow[] = [
  {
    id: 1,
    name: "Gin",
    menu_items: [
      {
        name: "Beefeater Dry",
        is_active: true,
        menu_item_prices: [
          { id: 10, serve: "single", amount: 4, display_order: 1, square_variation_id: "GIN-SGL" },
          { id: 11, serve: "double", amount: "7.00", display_order: 2, square_variation_id: null },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Alcopops",
    menu_items: [
      {
        name: "Breezer Orange",
        is_active: true,
        show_on_menu: false,
        menu_item_prices: [{ id: 20, serve: "each", amount: 5, display_order: 1, square_variation_id: null, show_on_menu: false }],
      },
      {
        name: "Retired",
        is_active: false,
        menu_item_prices: [{ id: 21, serve: "each", amount: 5, display_order: 1, square_variation_id: null }],
      },
    ],
  },
];

const lists = [
  {
    modifier_list_id: "ML-MIX",
    name: "Mixer",
    modifiers: [
      { id: "m0", name: "No Mixer", price: 0 },
      { id: "m1", name: "Tonic", price: 1.95 },
      { id: "m2", name: "Coke", price: 1.95 },
    ],
  },
  { modifier_list_id: "ML-SPRITZ", name: "Spritz", modifiers: [{ id: "s1", name: "Soda", price: 0 }] },
];

describe("isMixerList", () => {
  it("matches any list with mixer in its name", () => {
    expect(isMixerList("Mixer")).toBe(true);
    expect(isMixerList("Premium mixers")).toBe(true);
    expect(isMixerList("Spritz")).toBe(false);
  });
});

describe("serveOptionsFrom", () => {
  it("lists active items' serves with their category", () => {
    const serves = serveOptionsFrom(categories);
    expect(serves.map((serve) => serve.menuItemPriceId)).toEqual([10, 11, 20]);
    expect(serves[1]).toMatchObject({ amount: 7, categoryId: 1, categoryName: "Gin", hidden: false });
  });

  it("marks serves hidden from the menu", () => {
    expect(serveOptionsFrom(categories).find((serve) => serve.menuItemPriceId === 20)?.hidden).toBe(true);
  });
});

describe("buildSquareItemRows", () => {
  const serves = serveOptionsFrom(categories);
  const rows = buildSquareItemRows(
    [
      copyRow({ variation_id: "GIN-SGL", item_name: "Beefeater Dry", variation_name: "Single", modifier_list_ids: ["ML-MIX", "ML-SPRITZ"] }),
      copyRow({ variation_id: "GIN-DBL", item_name: "Beefeater Dry", variation_name: "Double", modifier_list_ids: ["ML-MIX"] }),
      copyRow({ variation_id: "BRZ-OR", item_name: "Breezer", variation_name: "Orange" }),
      copyRow({ variation_id: "TEE", item_name: "DF Black", variation_name: "XL", status: "Archived", price: null }),
    ],
    lists,
    serves
  );
  const byId = new Map(rows.map((row) => [row.variationId, row]));

  it("carries the linked serve and its category", () => {
    expect(byId.get("GIN-SGL")).toMatchObject({ linkedServeId: 10, linkedCategoryId: 1, suggestedServeId: null });
  });

  it("suggests serves for unlinked variations", () => {
    expect(byId.get("GIN-DBL")?.suggestedServeId).toBe(11);
    expect(byId.get("BRZ-OR")?.suggestedServeId).toBe(20);
    expect(byId.get("TEE")?.suggestedServeId).toBeNull();
  });

  it("shows only mixer modifier lists, with their price", () => {
    expect(byId.get("GIN-SGL")?.mixers).toEqual([
      { name: "Mixer", options: ["No Mixer", "Tonic", "Coke"], price: 1.95 },
    ]);
    expect(byId.get("BRZ-OR")?.mixers).toEqual([]);
  });

  it("marks archived items and keeps a missing price as null", () => {
    expect(byId.get("TEE")).toMatchObject({ archived: true, price: null });
  });

  it("sorts by item then variation", () => {
    expect(rows.map((row) => row.variationId)).toEqual(["GIN-DBL", "GIN-SGL", "BRZ-OR", "TEE"]);
  });
});

describe("hiddenServeLabel", () => {
  it("uses the menu's serve when Square's variation reads as one", () => {
    expect(hiddenServeLabel("Pint")).toBe("pint");
    expect(hiddenServeLabel("Half")).toBe("half pint");
    expect(hiddenServeLabel("Double")).toBe("double");
  });

  it("calls Square's Regular, or no variation name, each", () => {
    expect(hiddenServeLabel("Regular")).toBe("each");
    expect(hiddenServeLabel("")).toBe("each");
  });

  it("keeps Square's wording for anything else", () => {
    expect(hiddenServeLabel("Pitcher")).toBe("pitcher");
    expect(hiddenServeLabel("Shot Tray")).toBe("shot tray");
    expect(hiddenServeLabel("175ml")).toBe("175ml");
  });
});
