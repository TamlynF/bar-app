import { describe, expect, it } from "vitest";
import { squareVariationDetailFromRow, type VariationDetailRow } from "../square-variation-details";

const row: VariationDetailRow = {
  variation_id: "V1",
  item_id: "I1",
  item_name: "TJ Vodka",
  variation_name: "Double",
  pricing_type: "FIXED_PRICING",
  price: "7.50",
  currency: "GBP",
  reporting_category_name: "TRACKING - Vodka",
  modifier_list_ids: ["ML-MIX", "ML-GONE"],
  modifier_list_names: ["Mixers", "Old list"],
  inventory_tracking_location: false,
  stock_tracking: "not_tracked",
  stock_quantity: null,
  sold_by: null,
  sold_out_at: null,
  status: "Active",
  status_ext: "Available",
  sellable: true,
  stockable: true,
  is_archived: false,
  synced_at: "2026-10-01T05:21:00Z",
  deleted_at: null,
};

describe("squareVariationDetailFromRow", () => {
  const detail = squareVariationDetailFromRow(
    row,
    new Map([
      [
        "ML-MIX",
        {
          modifier_list_id: "ML-MIX",
          name: "Mixers",
          modifiers: [
            { id: "m0", name: "No Mixer", price: null },
            { id: "m1", name: "Coke", price: "1.95" },
          ],
        },
      ],
    ])
  );

  it("reads numbers that arrive as strings", () => {
    expect(detail.price).toBe(7.5);
    expect(detail.stockQuantity).toBeNull();
  });

  it("carries each modifier list with its options and prices", () => {
    expect(detail.modifierLists[0]).toEqual({
      id: "ML-MIX",
      name: "Mixers",
      options: [
        { name: "No Mixer", price: null },
        { name: "Coke", price: 1.95 },
      ],
    });
  });

  it("names a list the copy no longer holds from the variation, with no options", () => {
    expect(detail.modifierLists[1]).toEqual({ id: "ML-GONE", name: "Old list", options: [] });
  });

  it("treats a missing sold-out list as empty", () => {
    expect(detail.soldOutAt).toEqual([]);
  });
});
