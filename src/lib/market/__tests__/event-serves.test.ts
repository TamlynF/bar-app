import { describe, expect, it } from "vitest";
import {
  groupServesForPicker,
  serveLabel,
  serveOptionsFromCategories,
  type ServeCategoryRow,
} from "../event-serves";

const categories: ServeCategoryRow[] = [
  {
    id: 1,
    name: "Draught",
    menu_items: [
      {
        id: 10,
        name: "Guinness",
        is_active: true,
        menu_item_prices: [
          { id: 101, serve: "half", amount: "3.20", display_order: 1, square_variation_id: null },
          { id: 100, serve: "pint", amount: "6.20", display_order: 0, square_variation_id: "VAR_PINT" },
          { id: 102, serve: "taster", amount: 0, display_order: 2, square_variation_id: null },
        ],
      },
      {
        id: 11,
        name: "Amstel",
        is_active: false,
        menu_item_prices: [
          { id: 110, serve: "pint", amount: 5, display_order: 0, square_variation_id: null },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Soft",
    menu_items: [
      {
        id: 20,
        name: "Coke",
        is_active: true,
        menu_item_prices: [
          { id: 200, serve: "each", amount: 2.5, display_order: 0, square_variation_id: "VAR_COKE" },
        ],
      },
    ],
  },
];

describe("serveOptionsFromCategories", () => {
  it("lists every priced serve of every active item, serves in display order", () => {
    const options = serveOptionsFromCategories(categories);
    expect(options.map((o) => o.id)).toEqual([100, 101, 200]);
    expect(options[0]).toMatchObject({
      menuItemId: 10,
      name: "Guinness",
      serve: "pint",
      amount: 6.2,
      linked: true,
      categoryId: 1,
      categoryName: "Draught",
    });
    expect(options[1].linked).toBe(false);
  });
});

describe("groupServesForPicker", () => {
  it("nests category → item → serves", () => {
    const groups = groupServesForPicker(serveOptionsFromCategories(categories));
    expect(groups.map((g) => g.name)).toEqual(["Draught", "Soft"]);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].serves.map((s) => s.serve)).toEqual(["pint", "half"]);
  });
});

describe("serveLabel", () => {
  it("appends the serve unless it is the default 'each'", () => {
    expect(serveLabel("Guinness", "pint")).toBe("Guinness · pint");
    expect(serveLabel("Coke", "each")).toBe("Coke");
    expect(serveLabel("Coke", null)).toBe("Coke");
  });
});
