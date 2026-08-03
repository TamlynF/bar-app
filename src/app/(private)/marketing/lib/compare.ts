import { parseGbp } from "@/lib/price";
import type { CompetitorPrice, MenuItemLite } from "./types";

type Benchmark = { key: string; label: string; keywords: string[] };

const BENCHMARKS: Benchmark[] = [
  { key: "pint_lager", label: "Pint (Lager)", keywords: ["lager", "carling", "fosters", "madri", "amstel", "birra", "peroni", "stella"] },
  { key: "pint_ale", label: "Pint (Ale / Bitter / Stout)", keywords: ["ale", "bitter", "ipa", "stout", "guinness", "pale"] },
  { key: "spirit_mixer", label: "House Spirit + Mixer", keywords: ["gin", "vodka", "rum", "whisky", "whiskey", "spirit", "tonic", "mixer"] },
  { key: "wine_glass", label: "Wine (Glass)", keywords: ["wine", "merlot", "sauvignon", "chardonnay", "rose", "rosé", "prosecco", "malbec"] },
  { key: "soft_drink", label: "Soft Drink", keywords: ["coke", "cola", "pepsi", "lemonade", "fanta", "j2o", "soft", "soda", "juice"] },
  { key: "snack", label: "Snacks", keywords: ["crisps", "nuts", "olives", "snack", "nachos", "fries", "chips", "pork scratching"] },
];

export function matchBenchmark(name: string): Benchmark | null {
  const n = name.toLowerCase();
  return BENCHMARKS.find((b) => b.keywords.some((k) => n.includes(k))) ?? null;
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
    count: amounts.length,
  };
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
  competitorMin: number | null;
  competitorAvg: number | null;
  competitorMax: number | null;
  sampleCount: number;
  verdict: Verdict;
};

function verdictFor(own: number | null, avg: number | null): Verdict {
  if (own == null || avg == null) return "unknown";
  const diff = (own - avg) / avg;
  if (diff > 0.05) return "above";
  if (diff < -0.05) return "below";
  return "inline";
}

export function buildComparison(
  competitorPrices: CompetitorPrice[],
  menuItems: MenuItemLite[],
): BenchmarkComparison[] {
  return BENCHMARKS.map((b) => {
    const stats = competitorStats(competitorPrices, b.key);

    const ownMatches = menuItems
      .map((m) => ({ name: m.name, price: parseGbp(m.price) }))
      .filter((m) => matchBenchmark(m.name)?.key === b.key && m.price != null)
      .sort((a, z) => (a.price ?? 0) - (z.price ?? 0));
    const own = ownMatches[0] ?? null;

    return {
      key: b.key,
      label: b.label,
      ownPrice: own?.price ?? null,
      ownItemName: own?.name ?? null,
      competitorMin: stats.min,
      competitorAvg: stats.avg,
      competitorMax: stats.max,
      sampleCount: stats.count,
      verdict: verdictFor(own?.price ?? null, stats.avg),
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
    const b = matchBenchmark(m.name);
    const stats = competitorStats(competitorPrices, b?.key ?? null);
    const ownPrice = parseGbp(m.price);

    return {
      key: b?.key ?? `unmatched:${m.id}`,
      rowId: `item:${m.id}`,
      matchLabel: b?.label ?? null,
      label: m.name,
      ownPrice,
      ownItemName: m.category ?? null,
      competitorMin: stats.min,
      competitorAvg: stats.avg,
      competitorMax: stats.max,
      sampleCount: stats.count,
      verdict: verdictFor(ownPrice, stats.avg),
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
