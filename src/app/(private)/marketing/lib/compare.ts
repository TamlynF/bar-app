import { parseGbp } from "@/lib/price";
import type { CompetitorPrice, MenuItemLite } from "./types";

// Benchmark products we compare on. Matching is keyword-based on item names —
// pragmatic and clearly labelled "AI-estimated" in the UI.
type Benchmark = { key: string; label: string; keywords: string[] };

const BENCHMARKS: Benchmark[] = [
  { key: "pint_lager", label: "Pint (Lager)", keywords: ["lager", "carling", "fosters", "madri", "amstel", "birra", "peroni", "stella"] },
  { key: "pint_ale", label: "Pint (Ale / Bitter / Stout)", keywords: ["ale", "bitter", "ipa", "stout", "guinness", "pale"] },
  { key: "spirit_mixer", label: "House Spirit + Mixer", keywords: ["gin", "vodka", "rum", "whisky", "whiskey", "spirit", "tonic", "mixer"] },
  { key: "wine_glass", label: "Wine (Glass)", keywords: ["wine", "merlot", "sauvignon", "chardonnay", "rose", "rosé", "prosecco", "malbec"] },
  { key: "soft_drink", label: "Soft Drink", keywords: ["coke", "cola", "pepsi", "lemonade", "fanta", "j2o", "soft", "soda", "juice"] },
  { key: "snack", label: "Snacks", keywords: ["crisps", "nuts", "olives", "snack", "nachos", "fries", "chips", "pork scratching"] },
];

function matchBenchmark(name: string): Benchmark | null {
  const n = name.toLowerCase();
  return BENCHMARKS.find((b) => b.keywords.some((k) => n.includes(k))) ?? null;
}

export type Verdict = "above" | "below" | "inline" | "unknown";

export type BenchmarkComparison = {
  key: string;
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

/**
 * Build the per-benchmark comparison of the venue's own menu prices against
 * local competitor prices. Pure function — safe to unit test / reuse.
 */
export function buildComparison(
  competitorPrices: CompetitorPrice[],
  menuItems: MenuItemLite[],
): BenchmarkComparison[] {
  return BENCHMARKS.map((b) => {
    const compAmounts = competitorPrices
      .filter((c) => matchBenchmark(c.item_name)?.key === b.key)
      .map((c) => c.price_amount ?? parseGbp(c.price_text))
      .filter((v): v is number => v != null);

    const competitorMin = compAmounts.length ? Math.min(...compAmounts) : null;
    const competitorMax = compAmounts.length ? Math.max(...compAmounts) : null;
    const competitorAvg = compAmounts.length
      ? Math.round((compAmounts.reduce((s, v) => s + v, 0) / compAmounts.length) * 100) / 100
      : null;

    // Representative own item = cheapest menu item matching this benchmark.
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
      competitorMin,
      competitorAvg,
      competitorMax,
      sampleCount: compAmounts.length,
      verdict: verdictFor(own?.price ?? null, competitorAvg),
    };
  });
}

// ── Named-competitor matrix — your price vs each nearby venue, per benchmark ──
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

/**
 * All venues that have at least one benchmark-matching price, ranked by coverage
 * (most matches first). The UI defaults to the top few and lets the user pick.
 */
export function rankedVenues(competitorPrices: CompetitorPrice[]): string[] {
  const coverage = new Map<string, number>();
  pricedEntries(competitorPrices).forEach((p) => coverage.set(p.venue, (coverage.get(p.venue) ?? 0) + 1));
  return Array.from(coverage.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

/**
 * Build a "your price vs each named venue" grid for a chosen set of venues:
 * benchmark rows × the given venues (in order). Each cell is that venue's
 * cheapest price matching the benchmark, or null if none found.
 */
export function buildVenueMatrix(
  competitorPrices: CompetitorPrice[],
  comparison: BenchmarkComparison[],
  venues: string[],
): VenueMatrix {
  const priced = pricedEntries(competitorPrices);
  const venueSet = new Set(venues);

  // Cheapest price per (venue, benchmark).
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
