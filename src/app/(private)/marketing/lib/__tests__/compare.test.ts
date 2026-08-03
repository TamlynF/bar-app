import { describe, it, expect } from "vitest";
import { matchBenchmark, buildComparison, buildMenuComparison } from "../compare";
import type { CompetitorPrice, MenuItemLite } from "../types";

const key = (name: string) => matchBenchmark(name)?.key ?? null;

describe("matchBenchmark", () => {
  it("matches a lager by brand or type", () => {
    expect(key("DF Session Lager")).toBe("pint_lager");
    expect(key("Peroni 330ml")).toBe("pint_lager");
  });

  it("matches ales, stouts and IPAs", () => {
    expect(key("Guinness")).toBe("pint_ale");
    expect(key("DF Session IPA")).toBe("pint_ale");
  });

  it("keeps ginger ale and ginger beer out of the beer rounds", () => {
    expect(key("Ginger Ale")).toBe("soft_drink");
    expect(key("Old Jamaica Ginger Beer")).toBe("soft_drink");
  });

  it("does not read a spirit inside a longer word", () => {
    expect(key("Whitley Neill Rhubarb & Ginger")).toBeNull();
    expect(key("Gin & Tonic")).toBe("spirit_mixer");
    expect(key("TJ Vodka")).toBe("spirit_mixer");
  });

  it("treats a lone mixer as a soft drink", () => {
    expect(key("Tonic")).toBe("soft_drink");
    expect(key("Tonic Slimline")).toBe("soft_drink");
  });

  it("excludes alcohol-free serves from the pint rounds", () => {
    expect(key("Peroni 0%")).toBeNull();
    expect(key("Guinness 0%")).toBeNull();
    expect(key("Lucky Saint Alcohol Free")).toBeNull();
  });

  it("still matches snacks and wine", () => {
    expect(key("Nobby's Nuts Salted")).toBe("snack");
    expect(key("Sauvignon Blanc")).toBe("wine_glass");
  });

  it("falls back to the category when the name is only a brand", () => {
    expect(matchBenchmark("Beefeater Dry", "Gin")?.key).toBe("spirit_mixer");
    expect(matchBenchmark("Grey Goose", "Vodka")?.key).toBe("spirit_mixer");
    expect(matchBenchmark("Dead Man's Fingers Spiced", "Rum")?.key).toBe("spirit_mixer");
    expect(matchBenchmark("Jack Daniel's", "Whiskey")?.key).toBe("spirit_mixer");
    expect(matchBenchmark("Jose Cuervo Blanco", "Tequila")?.key).toBe("spirit_mixer");
    expect(matchBenchmark("Pinot Grigio", "White Wine")?.key).toBe("wine_glass");
    expect(matchBenchmark("Sprite", "Soft Drinks")?.key).toBe("soft_drink");
    expect(matchBenchmark("Pipers Salted", "Crisps")?.key).toBe("snack");
  });

  it("never lets an ambiguous category decide the round", () => {
    expect(matchBenchmark("Hawkstone Cider", "Draught")).toBeNull();
    expect(matchBenchmark("Desperados 330ml", "Bottled Selection")).toBeNull();
  });

  it("keeps a 0% serve out of its round however it is shelved", () => {
    expect(matchBenchmark("Tanqueray 0.0", "Gin")).toBeNull();
    expect(matchBenchmark("Corona 0%", "Non-Alcoholic")).toBeNull();
  });

  it("lets the name win over the category", () => {
    expect(matchBenchmark("Baby Guinness", "Shots")?.key).toBe("pint_ale");
  });
});

const competitor = (venue: string, item: string, amount: number): CompetitorPrice => ({
  id: `${venue}-${item}`,
  venue_name: venue,
  item_name: item,
  item_type: "drink",
  price_text: `£${amount.toFixed(2)}`,
  price_amount: amount,
  area: "Hinckley",
  source_url: null,
  source_name: null,
  fetched_at: "2026-01-01T00:00:00.000Z",
});

describe("buildComparison", () => {
  const lagerRow = (menu: MenuItemLite[]) =>
    buildComparison([competitor("The Flintlock", "Lager", 4.5)], menu).find((c) => c.key === "pint_lager");

  it("ignores a 0% beer when pricing your lager round", () => {
    const row = lagerRow([
      { id: 1, name: "Peroni 0%", price: "£3.50", category: "Draught" },
      { id: 2, name: "DF Session Lager", price: "£4.95", category: "Draught" },
    ]);
    expect(row?.ownItemName).toBe("DF Session Lager");
    expect(row?.ownPrice).toBe(4.95);
  });

  it("prefers a draught pint over a cheaper bottle", () => {
    const row = lagerRow([
      { id: 1, name: "Peroni 330ml", price: "£4.00", category: "Bottled Selection" },
      { id: 2, name: "DF Session Lager", price: "£4.95", category: "Draught" },
      { id: 3, name: "Hawkstone Premium Lager", price: "£5.50", category: "Draught" },
    ]);
    expect(row?.ownItemName).toBe("DF Session Lager");
  });

  it("falls back to any matching serve when no category fits", () => {
    const row = lagerRow([{ id: 1, name: "Peroni 330ml", price: "£4.00", category: "Bottled Selection" }]);
    expect(row?.ownItemName).toBe("Peroni 330ml");
  });

  it("never prices a stout round off a shot", () => {
    const rows = buildComparison([competitor("The Flintlock", "Guinness", 4.38)], [
      { id: 1, name: "Baby Guinness", price: "£4.00", category: "Shots" },
      { id: 2, name: "Guinness", price: "£4.95", category: "Draught" },
    ]);
    const ale = rows.find((c) => c.key === "pint_ale");
    expect(ale?.ownItemName).toBe("Guinness");
    expect(ale?.ownPrice).toBe(4.95);
  });

  it("leaves the round empty when only a wrong measure matches", () => {
    const rows = buildComparison([], [{ id: 1, name: "Baby Guinness", price: "£4.00", category: "Shots" }]);
    const ale = rows.find((c) => c.key === "pint_ale");
    expect(ale?.ownItemName).toBeNull();
    expect(ale?.ownPrice).toBeNull();
  });

  it("takes the typical price of the pool, not a single bargain line", () => {
    const rows = buildComparison([], [
      { id: 1, name: "Smiths Bacon Fries", price: "£1.00", category: "Crisps" },
      { id: 2, name: "Nobby's Nuts Salted", price: "£1.45", category: "Nuts" },
      { id: 3, name: "Nobby's Nuts Roasted", price: "£1.45", category: "Nuts" },
    ]);
    const snacks = rows.find((c) => c.key === "snack");
    expect(snacks?.ownPrice).toBe(1.45);
    expect(snacks?.ownPoolSize).toBe(3);
  });

  it("uses the lower middle of an even pool so the price is a real item", () => {
    const rows = buildComparison([], [
      { id: 1, name: "Tonic", price: "£1.95", category: "Soft Drinks" },
      { id: 2, name: "Coca Cola", price: "£2.75", category: "Soft Drinks" },
    ]);
    const soft = rows.find((c) => c.key === "soft_drink");
    expect(soft?.ownItemName).toBe("Tonic");
    expect(soft?.ownPrice).toBe(1.95);
  });

  it("does not price the spirit round off a cocktail", () => {
    const rows = buildComparison([], [
      { id: 1, name: "Whiskey Sour", price: "£8.00", category: "Cocktails" },
      { id: 2, name: "TJ Vodka", price: "£4.00", category: "Spirits" },
    ]);
    const spirit = rows.find((c) => c.key === "spirit_mixer");
    expect(spirit?.ownItemName).toBe("TJ Vodka");
  });

  it("prices the spirit round off the bar list, not the shot list", () => {
    const rows = buildComparison([], [
      { id: 1, name: "TJ Vodka", price: "£4.00 / 6 for £20.00", category: "Shots" },
      { id: 2, name: "Beefeater Dry", price: "£4.00 single / £7.00 double", category: "Gin" },
      { id: 3, name: "Grey Goose", price: "£5.00 single / £9.00 double", category: "Vodka" },
    ]);
    const spirit = rows.find((c) => c.key === "spirit_mixer");
    expect(spirit?.ownPoolSize).toBe(2);
    expect(spirit?.ownItemName).toBe("Beefeater Dry");
    expect(spirit?.ownPrice).toBe(4);
  });

  it("adds the mixer surcharge to the spirit round", () => {
    const rows = buildComparison([competitor("The Flintlock", "Gin & Tonic", 5.5)], [
      { id: 1, name: "Beefeater Dry", price: "£4.00 single / £7.00 double", category: "Gin", mixer_surcharge: 1.95 },
    ]);
    const spirit = rows.find((c) => c.key === "spirit_mixer");
    expect(spirit?.ownPrice).toBe(5.95);
    expect(spirit?.verdict).toBe("above");
  });

  it("leaves rounds without a mixer untouched by the surcharge", () => {
    const rows = buildComparison([], [
      { id: 1, name: "DF Session Lager", price: "£4.95", category: "Draught", mixer_surcharge: 1.45 },
    ]);
    expect(rows.find((c) => c.key === "pint_lager")?.ownPrice).toBe(4.95);
  });

  it("brings brand-named wines into the glass round", () => {
    const rows = buildComparison([], [
      { id: 1, name: "Pinot Grigio", price: "£5.95 small / £7.95 large", category: "White Wine" },
      { id: 2, name: "Sauvignon Blanc", price: "£6.75 small / £8.50 large", category: "White Wine" },
      { id: 3, name: "Oyster Bay", price: "£25.00 bottle", category: "White Wine" },
    ]);
    const wine = rows.find((c) => c.key === "wine_glass");
    expect(wine?.ownPoolSize).toBe(3);
    expect(wine?.ownPrice).toBe(6.75);
  });
});

describe("competitor centre", () => {
  const locals = [
    competitor("The Flintlock", "Lager", 4.5),
    competitor("The Anchor", "Lager", 4.6),
    competitor("The Crown", "Lager", 4.7),
    competitor("The Gastro", "Lager", 9.0),
  ];

  it("does not let one outlier flip the verdict", () => {
    const row = buildComparison(locals, [
      { id: 1, name: "DF Session Lager", price: "£4.95", category: "Draught" },
    ]).find((c) => c.key === "pint_lager");

    expect(row?.competitorAvg).toBe(5.7);
    expect(row?.competitorMedian).toBe(4.65);
    expect(row?.verdict).toBe("above");
  });

  it("averages the two middle prices on an even sample", () => {
    const row = buildComparison(locals, []).find((c) => c.key === "pint_lager");
    expect(row?.competitorMin).toBe(4.5);
    expect(row?.competitorMax).toBe(9);
    expect(row?.competitorMedian).toBe(4.65);
  });
});

describe("buildMenuComparison", () => {
  it("scores each menu item against the benchmark its name matches", () => {
    const menu: MenuItemLite[] = [
      { id: 7, name: "Hawkstone Premium Lager", price: "£5.50 pint / £3.00 half", category: "Draught" },
      { id: 8, name: "Hawkstone Cider", price: "£5.25", category: "Draught" },
    ];
    const rows = buildMenuComparison([competitor("The Flintlock", "Lager", 4.5)], menu);

    expect(rows[0].label).toBe("Hawkstone Premium Lager");
    expect(rows[0].ownPrice).toBe(5.5);
    expect(rows[0].matchLabel).toBe("Pint (Lager)");
    expect(rows[0].competitorAvg).toBe(4.5);
    expect(rows[0].competitorMedian).toBe(4.5);
    expect(rows[0].verdict).toBe("above");

    expect(rows[1].matchLabel).toBeNull();
    expect(rows[1].sampleCount).toBe(0);
  });
});
