import { describe, expect, it } from "vitest";
import { proposeMappings, type CatalogVariation, type MappingTarget } from "../mapping";

const variations: CatalogVariation[] = [
  { variationId: "V-NECK-PINT", itemName: "Neck Oil", variationName: "Pint" },
  { variationId: "V-NECK-HALF", itemName: "Neck Oil", variationName: "Half Pint" },
  { variationId: "V-COKE", itemName: "Coca-Cola", variationName: "Regular" },
  { variationId: "V-GIN-SGL", itemName: "Bombay Sapphire", variationName: "Single" },
  { variationId: "V-GIN-DBL", itemName: "Bombay Sapphire", variationName: "Double" },
];

function target(overrides: Partial<MappingTarget>): MappingTarget {
  return { menuItemPriceId: 1, itemName: "", serve: "each", servesOnItem: 1, ...overrides };
}

describe("proposeMappings", () => {
  it("matches item name plus serve", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 10, itemName: "Neck Oil", serve: "pint", servesOnItem: 2 }),
      target({ menuItemPriceId: 11, itemName: "Neck Oil", serve: "half pint", servesOnItem: 2 }),
    ]);
    expect(proposals.get(10)).toBe("V-NECK-PINT");
    expect(proposals.get(11)).toBe("V-NECK-HALF");
  });

  it("ignores punctuation and case in names", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 20, itemName: "coca cola", serve: "each" }),
    ]);
    expect(proposals.get(20)).toBe("V-COKE");
  });

  it("pairs a single-serve item with its only variation despite serve labels", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 30, itemName: "Coca-Cola", serve: "bottle" }),
    ]);
    expect(proposals.get(30)).toBe("V-COKE");
  });

  it("refuses to guess between multiple variations without a serve match", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 40, itemName: "Bombay Sapphire", serve: "glass" }),
    ]);
    expect(proposals.has(40)).toBe(false);
  });

  it("skips items with no catalog counterpart", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 50, itemName: "House Lemonade", serve: "each" }),
    ]);
    expect(proposals.size).toBe(0);
  });

  it("matches spirit serves by alias", () => {
    const proposals = proposeMappings(variations, [
      target({ menuItemPriceId: 60, itemName: "Bombay Sapphire", serve: "double", servesOnItem: 2 }),
    ]);
    expect(proposals.get(60)).toBe("V-GIN-DBL");
  });
});
