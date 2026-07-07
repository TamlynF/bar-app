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
