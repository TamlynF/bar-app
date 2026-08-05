import { parseGbp } from "@/lib/price";
import type { CompetitorPrice, MenuItemLite } from "./types";

type Benchmark = {
  key: string;
  label: string;
  keywords: string[];
  exclude?: string[];
  categories?: string[];
  wrongServe?: string[];
  addsMixer?: boolean;
};

// A low or no-alcohol serve isn't the same round as the real thing, so it never
// stands in for your pint price.
const PINT_CATEGORIES = ["draught", "draft", "keg", "beer", "cider", "pint", "tap"];

// Half measures, shots and tasters carry the drink's name but not its round.
const SMALL_SERVES = ["half", "third", "baby", "shot", "taster", "schooner"];

const ALCOHOL_FREE = ["0%", "0.0", "alcohol free", "alcohol-free", "non-alcoholic", "no alcohol", "zero alcohol"];

const BENCHMARKS: Benchmark[] = [
  {
    key: "pint_lager",
    label: "Pint (Lager)",
    keywords: ["lager", "carling", "fosters", "madri", "amstel", "birra", "peroni", "stella"],
    exclude: ALCOHOL_FREE,
    categories: PINT_CATEGORIES,
    wrongServe: SMALL_SERVES,
  },
  {
    key: "pint_ale",
    label: "Pint (Ale / Bitter / Stout)",
    keywords: ["ale", "bitter", "ipa", "stout", "guinness", "pale"],
    // "Ginger ale" and "ginger beer" are soft drinks wearing a beer's name.
    exclude: [...ALCOHOL_FREE, "ginger"],
    categories: PINT_CATEGORIES,
    wrongServe: SMALL_SERVES,
  },
  {
    key: "spirit_mixer",
    label: "House Spirit + Mixer",
    // The round is a spirit *with* a mixer - a lone tonic is a soft drink.
    keywords: ["gin", "vodka", "rum", "whisky", "whiskey", "spirit", "bourbon", "tequila"],
    exclude: ALCOHOL_FREE,
    // A spirit sold over the bar beats the same bottle sold as a shot.
    categories: ["spirit", "house", "gin", "vodka", "rum", "whisk", "tequila"],
    // Cocktails and bombs use the same spirits at a very different price.
    wrongServe: [...SMALL_SERVES, "sour", "martini", "mojito", "cocktail", "bomb"],
    addsMixer: true,
  },
  {
    key: "wine_glass",
    label: "Wine (Glass)",
    keywords: ["wine", "merlot", "sauvignon", "chardonnay", "rose", "rosé", "prosecco", "malbec"],
    categories: ["wine", "fizz", "champagne"],
    wrongServe: ["bottle", "carafe", "magnum"],
  },
  {
    key: "soft_drink",
    label: "Soft Drink",
    keywords: [
      "coke", "cola", "pepsi", "lemonade", "fanta", "j2o", "soft", "soda", "juice",
      "tonic", "ginger ale", "ginger beer",
    ],
  },
  {
    key: "snack",
    label: "Snacks",
    keywords: ["crisps", "nuts", "olives", "snack", "nachos", "fries", "chips", "pork scratching"],
    categories: ["snack", "crisp", "nut", "bar"],
  },
];

// Whole words only - otherwise "gin" matches "Ginger" and "ale" matches nothing
// it should. Keywords can contain spaces ("pork scratching"); the boundary is
// any non-alphanumeric character or the ends of the string.
function hasWord(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack);
}

// Categories that name their round on their own, for the many items whose name
// carries a brand and nothing else - "Beefeater Dry" in Gin, "Pinot Grigio" in
// White Wine. Deliberately narrower than the `categories` preference lists
// above: "Draught" pours lager, ale and cider, so it can never decide a round.
const CATEGORY_BENCHMARKS: { match: string; key: string }[] = [
  { match: "gin", key: "spirit_mixer" },
  { match: "vodka", key: "spirit_mixer" },
  { match: "rum", key: "spirit_mixer" },
  { match: "whisk", key: "spirit_mixer" },
  { match: "tequila", key: "spirit_mixer" },
  { match: "wine", key: "wine_glass" },
  { match: "prosecco", key: "wine_glass" },
  { match: "soft drink", key: "soft_drink" },
  { match: "crisp", key: "snack" },
  { match: "nut", key: "snack" },
  { match: "snack", key: "snack" },
];

export function matchBenchmark(name: string, category?: string | null): Benchmark | null {
  const n = name.toLowerCase();
  const byName = BENCHMARKS.find(
    (b) => !(b.exclude ?? []).some((x) => n.includes(x)) && b.keywords.some((k) => hasWord(n, k)),
  );
  if (byName) return byName;

  const c = (category ?? "").toLowerCase();
  if (!c) return null;

  const viaCategory = CATEGORY_BENCHMARKS.find((entry) => c.includes(entry.match));
  const fallback = viaCategory ? BENCHMARKS.find((b) => b.key === viaCategory.key) : undefined;
  if (!fallback) return null;

  // The name still has the last word on a 0% serve, whatever shelf it sits on.
  return (fallback.exclude ?? []).some((x) => n.includes(x)) ? null : fallback;
}

function competitorStats(competitorPrices: CompetitorPrice[], key: string | null) {
  const amounts = key
    ? competitorPrices
        .filter((c) => matchBenchmark(c.item_name)?.key === key)
        .map((c) => c.price_amount ?? parseGbp(c.price_text))
        .filter((v): v is number => v != null)
    : [];

  return {
    min: amounts.length ? Math.min(...amounts) : null,
    max: amounts.length ? Math.max(...amounts) : null,
    avg: amounts.length
      ? Math.round((amounts.reduce((s, v) => s + v, 0) / amounts.length) * 100) / 100
      : null,
    median: medianAmount(amounts),
    count: amounts.length,
  };
}

// Your own price is a median, so the local one has to be too - measuring a
// median against a mean lets one gastropub at £9 decide the verdict on a
// handful of samples. The mean is still reported alongside it.
function medianAmount(amounts: number[]): number | null {
  if (!amounts.length) return null;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

export type Verdict = "above" | "below" | "inline" | "unknown";

export type BenchmarkComparison = {
  // Which benchmark the local prices come from - several menu rows can share one.
  key: string;
  // Unique per row when comparing real menu items; benchmark rows don't need it.
  rowId?: string;
  // The local benchmark a menu row is measured against, for the row's sub-line.
  matchLabel?: string | null;
  label: string;
  ownPrice: number | null;
  ownItemName: string | null;
  // How many of your items were in the running for this round.
  ownPoolSize?: number;
  competitorMin: number | null;
  competitorAvg: number | null;
  // The centre the verdict is measured against.
  competitorMedian: number | null;
  competitorMax: number | null;
  sampleCount: number;
  verdict: Verdict;
};

function verdictFor(own: number | null, centre: number | null): Verdict {
  if (own == null || centre == null) return "unknown";
  const diff = (own - centre) / centre;
  if (diff > 0.05) return "above";
  if (diff < -0.05) return "below";
  return "inline";
}

export type OwnCandidate = { name: string; category: string; price: number };

// A single spirit and a spirit-with-a-mixer are different rounds. Where the
// round includes the mixer, the surcharge is part of what a guest pays.
function priceForRound(item: MenuItemLite, benchmark: Benchmark | null): number | null {
  const base = parseGbp(item.price);
  if (base == null) return null;
  return benchmark?.addsMixer ? base + (item.mixer_surcharge ?? 0) : base;
}

// Everything of yours that could legitimately stand for a round: right name,
// readable price, not a wrong measure, and - when any of them sit in a category
// that serves the round properly - only those.
export function ownPoolFor(menuItems: MenuItemLite[], benchmarkKey: string): OwnCandidate[] {
  const b = BENCHMARKS.find((x) => x.key === benchmarkKey);
  if (!b) return [];

  const candidates = menuItems
    .map((m) => ({
      name: m.name,
      category: (m.category ?? "").toLowerCase(),
      price: matchBenchmark(m.name, m.category)?.key === b.key ? priceForRound(m, b) : null,
    }))
    .filter(
      (m): m is OwnCandidate =>
        m.price != null && !(b.wrongServe ?? []).some((w) => hasWord(m.name, w)),
    );

  const preferred = candidates.filter((c) =>
    (b.categories ?? []).some((cat) => c.category.includes(cat)),
  );
  return preferred.length ? preferred : candidates;
}

// The typical price of the pool, not the cheapest - one bargain line shouldn't
// speak for the whole round. Even-sized pools take the lower middle so the
// number stays a real item you actually sell.
export function medianOf(pool: OwnCandidate[]): OwnCandidate | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, z) => a.price - z.price);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function meanPriceOf(pool: OwnCandidate[]): number | null {
  if (pool.length === 0) return null;
  return Math.round((pool.reduce((s, c) => s + c.price, 0) / pool.length) * 100) / 100;
}

export function buildComparison(
  competitorPrices: CompetitorPrice[],
  menuItems: MenuItemLite[],
): BenchmarkComparison[] {
  return BENCHMARKS.map((b) => {
    const stats = competitorStats(competitorPrices, b.key);
    const pool = ownPoolFor(menuItems, b.key);
    const own = medianOf(pool);

    return {
      key: b.key,
      label: b.label,
      ownPrice: own?.price ?? null,
      ownItemName: own?.name ?? null,
      ownPoolSize: pool.length,
      competitorMin: stats.min,
      competitorAvg: stats.avg,
      competitorMedian: stats.median,
      competitorMax: stats.max,
      sampleCount: stats.count,
      verdict: verdictFor(own?.price ?? null, stats.median),
    };
  });
}

// One row per real menu item instead of the six fixed rounds. Local prices still
// come from the benchmark the item's name matches, so a "Peroni" is measured
// against local lagers.
export function buildMenuComparison(
  competitorPrices: CompetitorPrice[],
  menuItems: MenuItemLite[],
): BenchmarkComparison[] {
  return menuItems.map((m) => {
    const b = matchBenchmark(m.name, m.category);
    const stats = competitorStats(competitorPrices, b?.key ?? null);
    const ownPrice = priceForRound(m, b);

    return {
      key: b?.key ?? `unmatched:${m.id}`,
      rowId: `item:${m.id}`,
      matchLabel: b?.label ?? null,
      label: m.name,
      ownPrice,
      ownItemName: m.category ?? null,
      competitorMin: stats.min,
      competitorAvg: stats.avg,
      competitorMedian: stats.median,
      competitorMax: stats.max,
      sampleCount: stats.count,
      verdict: verdictFor(ownPrice, stats.median),
    };
  });
}

export type VenueMatrix = {
  venues: string[];
  rows: { key: string; label: string; ownPrice: number | null; cells: (number | null)[] }[];
};

type PricedEntry = { venue: string; key: string; amount: number };

function pricedEntries(competitorPrices: CompetitorPrice[]): PricedEntry[] {
  return competitorPrices
    .map((p) => ({
      venue: p.venue_name,
      key: matchBenchmark(p.item_name)?.key ?? null,
      amount: p.price_amount ?? parseGbp(p.price_text),
    }))
    .filter((p): p is PricedEntry => !!p.venue && !!p.key && p.amount != null);
}

export function rankedVenues(competitorPrices: CompetitorPrice[]): string[] {
  const coverage = new Map<string, number>();
  pricedEntries(competitorPrices).forEach((p) => coverage.set(p.venue, (coverage.get(p.venue) ?? 0) + 1));
  return Array.from(coverage.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

export function buildVenueMatrix(
  competitorPrices: CompetitorPrice[],
  comparison: BenchmarkComparison[],
  venues: string[],
): VenueMatrix {
  const priced = pricedEntries(competitorPrices);
  const venueSet = new Set(venues);

  const cellMin = new Map<string, number>();
  priced.forEach((p) => {
    if (!venueSet.has(p.venue)) return;
    const k = `${p.venue}|${p.key}`;
    const cur = cellMin.get(k);
    if (cur == null || p.amount < cur) cellMin.set(k, p.amount);
  });

  const rows = comparison.map((c) => ({
    key: c.key,
    label: c.label,
    ownPrice: c.ownPrice,
    cells: venues.map((v) => cellMin.get(`${v}|${c.key}`) ?? null),
  }));

  return { venues, rows };
}
