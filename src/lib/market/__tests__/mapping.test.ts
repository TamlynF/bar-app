import { describe, expect, it } from "vitest";
import {
  looseName,
  proposeMappings,
  splitLinks,
  suggestMappings,
  type CatalogVariation,
  type MappingTarget,
} from "../mapping";

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

const liveVariations: CatalogVariation[] = [
  { variationId: "BREEZER-ORANGE", itemName: "Breezer", variationName: "Orange" },
  { variationId: "BREEZER-MELON", itemName: "Breezer", variationName: "Watermelon" },
  { variationId: "MOJITO-CLASSIC", itemName: "Mojito", variationName: "Classic Mojito" },
  { variationId: "MOJITO-STRAW", itemName: "Mojito", variationName: "Strawberry Mojito" },
  { variationId: "MOJITO-STRAW-OLD", itemName: "Mojito", variationName: "Strawberry" },
  { variationId: "PERONI", itemName: "Peroni", variationName: "Regular" },
  { variationId: "WUNDER", itemName: "Wundersauce", variationName: "Regular" },
  { variationId: "BAILEYS-DBL", itemName: "Baileys", variationName: "Double" },
  { variationId: "NOBBYS-ROAST", itemName: "Nobby's Nuts", variationName: "Roasted" },
  { variationId: "WN-RHUBARB-SGL", itemName: "Whitley Neill Rhubarb", variationName: "Single" },
  { variationId: "WN-RHUBARB-DBL", itemName: "Whitley Neill Rhubarb", variationName: "Double" },
  { variationId: "TONIC-FULL", itemName: "Tonic Full Fat", variationName: "Regular" },
  { variationId: "TONIC-SLIM", itemName: "Tonic Slimline", variationName: "Regular" },
];

describe("proposeMappings on the live catalog's naming", () => {
  it("drops sizes, brackets and apostrophes from menu names", () => {
    const proposals = proposeMappings(liveVariations, [
      target({ menuItemPriceId: 1, itemName: "Peroni 330ml" }),
      target({ menuItemPriceId: 2, itemName: "Wundersauce (Tropical)" }),
      target({ menuItemPriceId: 3, itemName: "Bailey's", serve: "double", servesOnItem: 2 }),
    ]);
    expect(proposals.get(1)).toBe("PERONI");
    expect(proposals.get(2)).toBe("WUNDER");
    expect(proposals.get(3)).toBe("BAILEYS-DBL");
  });

  it("finds the flavour in Square's variation name", () => {
    const proposals = proposeMappings(liveVariations, [
      target({ menuItemPriceId: 1, itemName: "Breezer Orange" }),
      target({ menuItemPriceId: 2, itemName: "Nobby's Nuts Roasted" }),
      target({ menuItemPriceId: 3, itemName: "Classic Mojito" }),
      target({ menuItemPriceId: 4, itemName: "Strawberry Mojito" }),
    ]);
    expect(proposals.get(1)).toBe("BREEZER-ORANGE");
    expect(proposals.get(2)).toBe("NOBBYS-ROAST");
    expect(proposals.get(3)).toBe("MOJITO-CLASSIC");
    expect(proposals.get(4)).toBe("MOJITO-STRAW");
  });

  it("never proposes a variation already linked elsewhere", () => {
    const proposals = proposeMappings(
      liveVariations,
      [target({ menuItemPriceId: 1, itemName: "Peroni" })],
      new Set(["PERONI"])
    );
    expect(proposals.size).toBe(0);
  });

  it("never proposes one variation for two serves", () => {
    const proposals = proposeMappings(liveVariations, [
      target({ menuItemPriceId: 1, itemName: "Peroni" }),
      target({ menuItemPriceId: 2, itemName: "Peroni 330ml" }),
    ]);
    expect([...proposals.values()]).toEqual(["PERONI"]);
  });

  it("leaves near names to suggestions", () => {
    const proposals = proposeMappings(liveVariations, [
      target({ menuItemPriceId: 1, itemName: "Whitley Neill Rhubarb & Ginger", serve: "single", servesOnItem: 2 }),
    ]);
    expect(proposals.size).toBe(0);
  });
});

describe("suggestMappings", () => {
  it("suggests the Square item sharing most words, matched on serve", () => {
    const suggestions = suggestMappings(liveVariations, [
      target({ menuItemPriceId: 1, itemName: "Whitley Neill Rhubarb & Ginger", serve: "single", servesOnItem: 2 }),
      target({ menuItemPriceId: 2, itemName: "Whitley Neill Rhubarb & Ginger", serve: "double", servesOnItem: 2 }),
    ]);
    expect(suggestions.get(1)?.variationId).toBe("WN-RHUBARB-SGL");
    expect(suggestions.get(2)?.variationId).toBe("WN-RHUBARB-DBL");
  });

  it("stays quiet when two items tie", () => {
    const suggestions = suggestMappings(liveVariations, [target({ menuItemPriceId: 1, itemName: "Tonic" })]);
    expect(suggestions.size).toBe(0);
  });

  it("stays quiet when little is shared", () => {
    const suggestions = suggestMappings(liveVariations, [target({ menuItemPriceId: 1, itemName: "House Lemonade" })]);
    expect(suggestions.size).toBe(0);
  });
});

describe("splitLinks", () => {
  it("treats links to variations missing from the catalog as unlinked", () => {
    const { targets, taken } = splitLinks(
      [
        { menuItemPriceId: 1, itemName: "Peroni", serve: "each", servesOnItem: 1, squareVariationId: "PERONI" },
        { menuItemPriceId: 2, itemName: "Guinness", serve: "pint", servesOnItem: 2, squareVariationId: "SANDBOX-ID" },
        { menuItemPriceId: 3, itemName: "Guinness", serve: "half pint", servesOnItem: 2, squareVariationId: null },
      ],
      new Set(["PERONI"])
    );
    expect(taken).toEqual(new Set(["PERONI"]));
    expect(targets.map((t) => t.menuItemPriceId)).toEqual([2, 3]);
  });
});

describe("looseName", () => {
  it("strips sizes, brackets and apostrophes", () => {
    expect(looseName("Hawkstone Dark Fruit 500ml")).toBe("hawkstone dark fruit");
    expect(looseName("Cherryburster (Cherry)")).toBe("cherryburster");
    expect(looseName("Bailey's")).toBe("baileys");
  });
});

describe("proposeMappings for shots and accents", () => {
  const shots: CatalogVariation[] = [
    { variationId: "JAGER-SHOT", itemName: "Jägermeister", variationName: "Shot" },
    { variationId: "JAGER-TRAY", itemName: "Jägermeister", variationName: "Shot Tray" },
    { variationId: "SPUMANTE-GLASS", itemName: "Spumante", variationName: "125ml" },
    { variationId: "SPUMANTE-BTL", itemName: "Spumante", variationName: "Bottle" },
  ];

  it("reads a serve sold each as Square's single shot, ignoring accents", () => {
    const proposals = proposeMappings(shots, [target({ menuItemPriceId: 1, itemName: "Jagermeister" })]);
    expect(proposals.get(1)).toBe("JAGER-SHOT");
  });

  it("never pairs a serve with a variation for a different measure", () => {
    const proposals = proposeMappings(shots, [
      target({ menuItemPriceId: 1, itemName: "Spumante", serve: "glass", servesOnItem: 2 }),
      target({ menuItemPriceId: 2, itemName: "Spumante", serve: "bottle", servesOnItem: 2 }),
    ]);
    expect(proposals.get(2)).toBe("SPUMANTE-BTL");
    expect(proposals.get(1)).not.toBe("SPUMANTE-BTL");
  });
});

describe("suggestMappings for spelling differences", () => {
  it("treats run-together and plural names as the same", () => {
    const suggestions = suggestMappings(
      [
        { variationId: "CB", itemName: "Cherry Burster", variationName: "Regular" },
        { variationId: "JAM-SGL", itemName: "Jameson", variationName: "Single" },
      ],
      [
        target({ menuItemPriceId: 1, itemName: "Cherryburster (Cherry)" }),
        target({ menuItemPriceId: 2, itemName: "Jamesons", serve: "single", servesOnItem: 2 }),
      ]
    );
    expect(suggestions.get(1)?.variationId).toBe("CB");
    expect(suggestions.get(2)?.variationId).toBe("JAM-SGL");
  });
});
