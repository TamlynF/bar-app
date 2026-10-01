import { describe, expect, it } from "vitest";
import { linkedCategoryUpdates } from "../variation-categories";

describe("linkedCategoryUpdates", () => {
  it("points each variation at its linked serve's category and clears unlinked ones", () => {
    const updates = linkedCategoryUpdates(
      [
        { variation_id: "A", menu_category_id: null, menu_category_manual: false },
        { variation_id: "B", menu_category_id: 3, menu_category_manual: false },
        { variation_id: "C", menu_category_id: 5, menu_category_manual: false },
      ],
      new Map([
        ["A", 7],
        ["C", 5],
      ])
    );
    expect(updates.get(7)).toEqual(["A"]);
    expect(updates.get(null)).toEqual(["B"]);
    expect(updates.size).toBe(2);
  });

  it("leaves categories picked by hand alone", () => {
    const updates = linkedCategoryUpdates(
      [{ variation_id: "A", menu_category_id: 9, menu_category_manual: true }],
      new Map([["A", 7]])
    );
    expect(updates.size).toBe(0);
  });

  it("compares ids that arrive as strings", () => {
    const updates = linkedCategoryUpdates(
      [{ variation_id: "A", menu_category_id: "7" as unknown as number, menu_category_manual: false }],
      new Map([["A", 7]])
    );
    expect(updates.size).toBe(0);
  });
});
