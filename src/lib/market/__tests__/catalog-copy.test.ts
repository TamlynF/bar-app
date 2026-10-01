import { describe, expect, it } from "vitest";
import { catalogCopyFromRows, modifierListFromRow, modifierListOptionsFromRows } from "../catalog-copy";

const rows = [
  { variation_id: "V3", item_id: "GOOSE", item_name: "Grey Goose", variation_name: "single", inventory_tracking_location: false },
  { variation_id: "V1", item_id: "DAMM", item_name: "Damm Lemon", variation_name: "pint", inventory_tracking_location: true },
  { variation_id: "V2", item_id: "GOOSE", item_name: "Grey Goose", variation_name: "double", inventory_tracking_location: false },
];

describe("catalogCopyFromRows", () => {
  const copy = catalogCopyFromRows(rows);

  it("lists the variations for the dropdown in item then variation order", () => {
    expect(copy.variations).toEqual([
      { variationId: "V1", itemName: "Damm Lemon", variationName: "pint" },
      { variationId: "V2", itemName: "Grey Goose", variationName: "double" },
      { variationId: "V3", itemName: "Grey Goose", variationName: "single" },
    ]);
  });

  it("maps each variation to its Square item for the dashboard links", () => {
    expect(copy.itemIdByVariation).toEqual({ V1: "DAMM", V2: "GOOSE", V3: "GOOSE" });
  });

  it("flags the variations Square does not track stock for at the venue", () => {
    expect(copy.untrackedVariationIds).toEqual(["V2", "V3"]);
  });
});

const mixerRow = {
  modifier_list_id: "MIXER",
  name: "Mixer",
  modifiers: [
    { id: "NONE", name: "No Mixer", price: null },
    { id: "COKE", name: "Coke", price: 1.95 },
    { id: "TONIC", name: "Tonic", price: 1.95 },
  ],
};

describe("modifierListFromRow", () => {
  it("keeps every option id but only the priced options' prices", () => {
    expect(modifierListFromRow(mixerRow)).toEqual({
      id: "MIXER",
      name: "Mixer",
      modifierPrices: [1.95, 1.95],
      modifierIds: ["NONE", "COKE", "TONIC"],
    });
  });
});

describe("modifierListOptionsFromRows", () => {
  it("lists what each modifier list offers, its price and the items carrying it", () => {
    const options = modifierListOptionsFromRows(
      [mixerRow, { modifier_list_id: "SYRUP", name: "Add Syrup", modifiers: [{ id: "V", name: "Vanilla", price: 0.5 }, { id: "C", name: "Caramel", price: 0.75 }] }],
      [
        { item_id: "GOOSE", item_name: "Grey Goose", modifier_list_ids: ["MIXER"] },
        { item_id: "GOOSE", item_name: "Grey Goose", modifier_list_ids: ["MIXER"] },
        { item_id: "AMARETTO", item_name: "Amaretto", modifier_list_ids: ["MIXER"] },
        { item_id: "LATTE", item_name: "Latte", modifier_list_ids: ["SYRUP"] },
      ]
    );
    expect(options).toEqual([
      { id: "SYRUP", name: "Add Syrup", modifierNames: ["Vanilla", "Caramel"], price: expect.any(Number), mixedPrices: true, itemNames: ["Latte"] },
      {
        id: "MIXER",
        name: "Mixer",
        modifierNames: ["No Mixer", "Coke", "Tonic"],
        price: 1.95,
        mixedPrices: false,
        itemNames: ["Amaretto", "Grey Goose"],
      },
    ]);
  });
});
