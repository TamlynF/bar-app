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
    expect(rows[0].verdict).toBe("above");

    expect(rows[1].matchLabel).toBeNull();
    expect(rows[1].sampleCount).toBe(0);
  });
});
