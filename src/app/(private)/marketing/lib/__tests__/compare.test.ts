import { describe, it, expect } from "vitest";
import {
  DEFAULT_BENCHMARKS,
  matchBenchmark,
  buildComparison,
  buildMenuComparison,
} from "../compare";
import type { CompetitorPrice, MenuItemLite, PriceBenchmark } from "../types";

const ROUNDS = DEFAULT_BENCHMARKS;
const key = (name: string) => matchBenchmark(name, null, ROUNDS)?.key ?? null;
const viaCategory = (name: string, category: string) =>
  matchBenchmark(name, category, ROUNDS)?.key ?? null;

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
    expect(viaCategory("Beefeater Dry", "Gin")).toBe("spirit_mixer");
    expect(viaCategory("Grey Goose", "Vodka")).toBe("spirit_mixer");
    expect(viaCategory("Dead Man's Fingers Spiced", "Rum")).toBe("spirit_mixer");
    expect(viaCategory("Jack Daniel's", "Whiskey")).toBe("spirit_mixer");
    expect(viaCategory("Jose Cuervo Blanco", "Tequila")).toBe("spirit_mixer");
    expect(viaCategory("Pinot Grigio", "White Wine")).toBe("wine_glass");
    expect(viaCategory("Sprite", "Soft Drinks")).toBe("soft_drink");
    expect(viaCategory("Pipers Salted", "Crisps")).toBe("snack");
  });

  it("never lets an ambiguous category decide the round", () => {
    expect(viaCategory("Desperados 330ml", "Bottled Selection")).toBeNull();
    expect(viaCategory("Damm Lemon", "Draught")).toBeNull();
  });

  it("gives cider its own round", () => {
    expect(key("Hawkstone Cider")).toBe("pint_cider");
    expect(key("Old Mout Berries & Cherries")).toBe("pint_cider");
    expect(viaCategory("Inch's", "Cider")).toBe("pint_cider");
    expect(key("Corona 0%")).toBeNull();
  });

  it("keeps a 0% serve out of its round however it is shelved", () => {
    expect(matchBenchmark("Tanqueray 0.0", "Gin", ROUNDS)).toBeNull();
    expect(matchBenchmark("Corona 0%", "Non-Alcoholic", ROUNDS)).toBeNull();
  });

  it("lets the name win over the category", () => {
    expect(viaCategory("Baby Guinness", "Shots")).toBe("pint_ale");
  });

  it("ignores a round that has been switched off", () => {
    const withoutLager = ROUNDS.map((b) =>
      b.key === "pint_lager" ? { ...b, is_active: false } : b,
    );
    expect(matchBenchmark("DF Session Lager", "Draught", withoutLager)).toBeNull();
  });

  it("has no keyword rules for a round somebody added, so only a hand-set key fills it", () => {
    const withCoffee: PriceBenchmark[] = [
      ...ROUNDS,
      { id: 99, key: "coffee", label: "Coffee", serves: "each", display_order: 8, is_active: true },
    ];
    expect(matchBenchmark("Flat White", "Coffee", withCoffee)).toBeNull();
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
    buildComparison([competitor("The Flintlock", "Lager", 4.5)], menu, ROUNDS).find(
      (c) => c.key === "pint_lager",
    );

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
    const row = lagerRow([
      { id: 1, name: "Peroni 330ml", price: "£4.00", category: "Bottled Selection" },
    ]);
    expect(row?.ownItemName).toBe("Peroni 330ml");
  });

  it("never prices a stout round off a shot", () => {
    const rows = buildComparison(
      [competitor("The Flintlock", "Guinness", 4.38)],
      [
        { id: 1, name: "Baby Guinness", price: "£4.00", category: "Shots" },
        { id: 2, name: "Guinness", price: "£4.95", category: "Draught" },
      ],
      ROUNDS,
    );
    const ale = rows.find((c) => c.key === "pint_ale");
    expect(ale?.ownItemName).toBe("Guinness");
    expect(ale?.ownPrice).toBe(4.95);
  });

  it("leaves the round empty when only a wrong measure matches", () => {
    const rows = buildComparison(
      [],
      [{ id: 1, name: "Baby Guinness", price: "£4.00", category: "Shots" }],
      ROUNDS,
    );
    const ale = rows.find((c) => c.key === "pint_ale");
    expect(ale?.ownItemName).toBeNull();
    expect(ale?.ownPrice).toBeNull();
  });

  it("takes the typical price of the pool, not a single bargain line", () => {
    const rows = buildComparison(
      [],
      [
        { id: 1, name: "Smiths Bacon Fries", price: "£1.00", category: "Crisps" },
        { id: 2, name: "Nobby's Nuts Salted", price: "£1.45", category: "Nuts" },
        { id: 3, name: "Nobby's Nuts Roasted", price: "£1.45", category: "Nuts" },
      ],
      ROUNDS,
    );
    const snacks = rows.find((c) => c.key === "snack");
    expect(snacks?.ownPrice).toBe(1.45);
    expect(snacks?.ownPoolSize).toBe(3);
  });

  it("uses the lower middle of an even pool so the price is a real item", () => {
    const rows = buildComparison(
      [],
      [
        { id: 1, name: "Tonic", price: "£1.95", category: "Soft Drinks" },
        { id: 2, name: "Coca Cola", price: "£2.75", category: "Soft Drinks" },
      ],
      ROUNDS,
    );
    const soft = rows.find((c) => c.key === "soft_drink");
    expect(soft?.ownItemName).toBe("Tonic");
    expect(soft?.ownPrice).toBe(1.95);
  });

  it("does not price the spirit round off a cocktail", () => {
    const rows = buildComparison(
      [],
      [
        { id: 1, name: "Whiskey Sour", price: "£8.00", category: "Cocktails" },
        { id: 2, name: "TJ Vodka", price: "£4.00", category: "Spirits" },
      ],
      ROUNDS,
    );
    expect(rows.find((c) => c.key === "spirit_mixer")?.ownItemName).toBe("TJ Vodka");
  });

  it("prices the spirit round off the bar list, not the shot list", () => {
    const rows = buildComparison(
      [],
      [
        { id: 1, name: "TJ Vodka", price: "£4.00 / 6 for £20.00", category: "Shots" },
        { id: 2, name: "Beefeater Dry", price: "£4.00 single / £7.00 double", category: "Gin" },
        { id: 3, name: "Grey Goose", price: "£5.00 single / £9.00 double", category: "Vodka" },
      ],
      ROUNDS,
    );
    const spirit = rows.find((c) => c.key === "spirit_mixer");
    expect(spirit?.ownPoolSize).toBe(2);
    expect(spirit?.ownItemName).toBe("Beefeater Dry");
    expect(spirit?.ownPrice).toBe(4);
  });

  it("adds the mixer surcharge to the spirit round", () => {
    const rows = buildComparison(
      [competitor("The Flintlock", "Gin & Tonic", 5.5)],
      [
        {
          id: 1,
          name: "Beefeater Dry",
          price: "£4.00 single / £7.00 double",
          category: "Gin",
          mixer_surcharge: 1.95,
        },
      ],
      ROUNDS,
    );
    const spirit = rows.find((c) => c.key === "spirit_mixer");
    expect(spirit?.ownPrice).toBe(5.95);
    expect(spirit?.verdict).toBe("above");
  });

  it("leaves rounds without a mixer untouched by the surcharge", () => {
    const rows = buildComparison(
      [],
      [{ id: 1, name: "DF Session Lager", price: "£4.95", category: "Draught", mixer_surcharge: 1.45 }],
      ROUNDS,
    );
    expect(rows.find((c) => c.key === "pint_lager")?.ownPrice).toBe(4.95);
  });

  it("brings brand-named wines into the glass round", () => {
    const rows = buildComparison(
      [],
      [
        { id: 1, name: "Pinot Grigio", price: "£5.95 small / £7.95 large", category: "White Wine" },
        { id: 2, name: "Sauvignon Blanc", price: "£6.75 small / £8.50 large", category: "White Wine" },
        { id: 3, name: "Oyster Bay", price: "£25.00 bottle", category: "White Wine" },
      ],
      ROUNDS,
    );
    const wine = rows.find((c) => c.key === "wine_glass");
    expect(wine?.ownPoolSize).toBe(3);
    expect(wine?.ownPrice).toBe(6.75);
  });

  it("skips a round that has been switched off", () => {
    const withoutSnacks = ROUNDS.map((b) =>
      b.key === "snack" ? { ...b, is_active: false } : b,
    );
    const rows = buildComparison([], [], withoutSnacks);
    expect(rows.map((r) => r.key)).not.toContain("snack");
    expect(rows).toHaveLength(ROUNDS.length - 1);
  });

  it("takes its rounds, labels and order from the benchmarks it is given", () => {
    const custom: PriceBenchmark[] = [
      { id: 1, key: "snack", label: "Bar snacks", serves: "each", display_order: 2, is_active: true },
      { id: 2, key: "soft_drink", label: "Softs", serves: "each", display_order: 1, is_active: true },
    ];
    const rows = buildComparison([], [], custom);
    expect(rows.map((r) => r.label)).toEqual(["Softs", "Bar snacks"]);
  });
});

describe("prices by serve", () => {
  const pintRow = (menu: MenuItemLite[]) =>
    buildComparison([], menu, ROUNDS).find((c) => c.key === "pint_lager");

  it("takes the serve the round is sold in, not the first amount in the text", () => {
    const row = pintRow([
      {
        id: 1,
        name: "DF Session Lager",
        price: "£2.95 half pint / £4.95 pint",
        category: "Draught",
        prices: [
          { serve: "half pint", amount: 2.95 },
          { serve: "pint", amount: 4.95 },
        ],
      },
    ]);
    expect(row?.ownPrice).toBe(4.95);
  });

  it("keeps a bottle-only wine out of the glass round", () => {
    const rows = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Oyster Bay",
          price: "£25.00 bottle",
          category: "White Wine",
          prices: [{ serve: "bottle", amount: 25 }],
        },
        {
          id: 2,
          name: "Pinot Grigio",
          price: "£5.95 small / £7.95 large",
          category: "White Wine",
          prices: [
            { serve: "small", amount: 5.95 },
            { serve: "large", amount: 7.95 },
          ],
        },
      ],
      ROUNDS,
    );
    const wine = rows.find((c) => c.key === "wine_glass");
    expect(wine?.ownPoolSize).toBe(1);
    expect(wine?.ownItemName).toBe("Pinot Grigio");
    expect(wine?.ownPrice).toBe(5.95);
  });

  it("drops a half-only serve from the pint round without needing the name", () => {
    const row = pintRow([
      {
        id: 1,
        name: "Madri",
        price: "£2.80 half pint",
        category: "Draught",
        prices: [{ serve: "half pint", amount: 2.8 }],
      },
    ]);
    expect(row?.ownItemName).toBeNull();
  });

  it("adds the mixer surcharge to the serve the round asks for", () => {
    const rows = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Beefeater Dry",
          price: "£4.00 single / £7.00 double",
          category: "Gin",
          mixer_surcharge: 1.45,
          prices: [
            { serve: "single", amount: 4 },
            { serve: "double", amount: 7 },
          ],
        },
      ],
      ROUNDS,
    );
    expect(rows.find((c) => c.key === "spirit_mixer")?.ownPrice).toBe(5.45);
  });

  it("matches a round that accepts more than one serve", () => {
    const rows = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Beppe Morchetta Spumante",
          price: "£4.95 glass / £24.95 bottle",
          category: "Wine",
          prices: [
            { serve: "glass", amount: 4.95 },
            { serve: "bottle", amount: 24.95 },
          ],
        },
      ],
      ROUNDS,
    );
    expect(rows.find((c) => c.key === "wine_glass")?.ownPrice).toBe(4.95);
  });

  it("still keeps a wrongly-shelved item out even when its serve fits", () => {
    const rows = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Prosecco",
          price: "£4.95 glass",
          category: "Prosecco",
          prices: [{ serve: "glass", amount: 4.95 }],
        },
        {
          id: 2,
          name: "Pinot Grigio",
          price: "£5.95 small",
          category: "White Wine",
          prices: [{ serve: "small", amount: 5.95 }],
        },
      ],
      ROUNDS,
    );
    const wine = rows.find((c) => c.key === "wine_glass");
    expect(wine?.ownPoolSize).toBe(1);
    expect(wine?.ownItemName).toBe("Pinot Grigio");
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
    const row = buildComparison(
      locals,
      [{ id: 1, name: "DF Session Lager", price: "£4.95", category: "Draught" }],
      ROUNDS,
    ).find((c) => c.key === "pint_lager");

    expect(row?.competitorAvg).toBe(5.7);
    expect(row?.competitorMedian).toBe(4.65);
    expect(row?.verdict).toBe("above");
  });

  it("averages the two middle prices on an even sample", () => {
    const row = buildComparison(locals, [], ROUNDS).find((c) => c.key === "pint_lager");
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
    const rows = buildMenuComparison([competitor("The Flintlock", "Lager", 4.5)], menu, ROUNDS);

    expect(rows[0].label).toBe("Hawkstone Premium Lager");
    expect(rows[0].ownPrice).toBe(5.5);
    expect(rows[0].matchLabel).toBe("Pint (Lager)");
    expect(rows[0].competitorAvg).toBe(4.5);
    expect(rows[0].competitorMedian).toBe(4.5);
    expect(rows[0].verdict).toBe("above");

    expect(rows[1].matchLabel).toBe("Pint (Cider)");
    expect(rows[1].sampleCount).toBe(0);
  });

  it("measures an item against the round set on it by hand", () => {
    const rows = buildMenuComparison(
      [competitor("The Flintlock", "Lager", 4.5)],
      [
        {
          id: 9,
          name: "Damm Lemon",
          price: "£4.75 pint",
          category: "Draught",
          benchmark_key: "pint_lager",
        },
      ],
      ROUNDS,
    );
    expect(rows[0].matchLabel).toBe("Pint (Lager)");
    expect(rows[0].competitorMedian).toBe(4.5);
    expect(rows[0].verdict).toBe("above");
  });
});

describe("a round set by hand", () => {
  it("brings in an item no keyword or category could place", () => {
    const row = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Damm Lemon",
          price: "£4.75 pint",
          category: "Draught",
          benchmark_key: "pint_lager",
        },
      ],
      ROUNDS,
    ).find((c) => c.key === "pint_lager");

    expect(row?.ownItemName).toBe("Damm Lemon");
    expect(row?.ownPrice).toBe(4.75);
  });

  it("keeps an item out of the round its name would claim", () => {
    const row = buildComparison(
      [],
      [
        { id: 1, name: "Guinness", price: "£4.95", category: "Draught", benchmark_key: "none" },
        { id: 2, name: "DF Session IPA", price: "£5.20", category: "Draught" },
      ],
      ROUNDS,
    ).find((c) => c.key === "pint_ale");

    expect(row?.ownItemName).toBe("DF Session IPA");
    expect(row?.ownPoolSize).toBe(1);
  });

  it("overrules the wrong-measure filter", () => {
    const row = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Half Madri",
          price: "£2.80",
          category: "Draught",
          benchmark_key: "pint_lager",
        },
      ],
      ROUNDS,
    ).find((c) => c.key === "pint_lager");

    expect(row?.ownItemName).toBe("Half Madri");
  });

  it("overrules the category preference so a pinned bottle still counts", () => {
    const row = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Peroni 330ml",
          price: "£4.00",
          category: "Bottled Selection",
          benchmark_key: "pint_lager",
        },
        { id: 2, name: "DF Session Lager", price: "£4.95", category: "Draught" },
        { id: 3, name: "Hawkstone Premium Lager", price: "£5.50", category: "Draught" },
      ],
      ROUNDS,
    ).find((c) => c.key === "pint_lager");

    expect(row?.ownPoolSize).toBe(3);
    expect(row?.ownItemName).toBe("DF Session Lager");
  });

  it("ignores a key that names no round", () => {
    const row = buildComparison(
      [],
      [
        {
          id: 1,
          name: "DF Session Lager",
          price: "£4.95",
          category: "Draught",
          benchmark_key: "pint_mead",
        },
      ],
      ROUNDS,
    ).find((c) => c.key === "pint_lager");

    expect(row?.ownItemName).toBeNull();
  });

  it("fills a round that has no keyword rules at all", () => {
    const withCoffee: PriceBenchmark[] = [
      ...ROUNDS,
      { id: 99, key: "coffee", label: "Coffee", serves: "each", display_order: 8, is_active: true },
    ];
    const row = buildComparison(
      [],
      [
        {
          id: 1,
          name: "Flat White",
          price: "£3.20",
          category: "Coffee",
          benchmark_key: "coffee",
          prices: [{ serve: "each", amount: 3.2 }],
        },
      ],
      withCoffee,
    ).find((c) => c.key === "coffee");

    expect(row?.ownItemName).toBe("Flat White");
    expect(row?.ownPrice).toBe(3.2);
  });
});
