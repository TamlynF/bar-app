// src/lib/quiz/higher-lower.ts
//
// A Higher-or-Lower round is a chain: question 1 is compared against a year the
// host sets, and every question after that is compared against the PREVIOUS
// question's answer. So the allowed years for a song depend on which song was
// picked before it - there is no per-song rule to check in isolation.
//
// Nothing here talks to Supabase or to the model. The sheet, the save action and
// the repair-after-delete helper all defer to these functions so the rule has
// exactly one definition.

export type YearRange = { minYears: number; maxYears: number };

// Backtracking over a pool of ~25 songs is cheap, but a pathological pool could
// still walk a long way. Bounded so a generation can never hang the sheet.
const SEARCH_BUDGET = 20000;

export const DEFAULT_YEAR_RANGE: YearRange = { minYears: 3, maxYears: 10 };
export const DEFAULT_START_YEAR = 1990;

function normaliseRange(range: YearRange): YearRange {
  // A zero gap is never legal - the song would have been released in the very
  // year it is compared against, and neither answer would be right.
  return { minYears: Math.max(1, Math.round(range.minYears)), maxYears: Math.round(range.maxYears) };
}

export function isValidStep(
  candidateYear: number | null | undefined,
  comparisonYear: number | null | undefined,
  range: YearRange
): boolean {
  if (!Number.isFinite(candidateYear) || !Number.isFinite(comparisonYear)) return false;

  const { minYears, maxYears } = normaliseRange(range);
  if (maxYears < minYears) return false;

  const gap = Math.abs((candidateYear as number) - (comparisonYear as number));
  return gap >= minYears && gap <= maxYears;
}

// null when the step is legal; otherwise the reason, phrased for the person
// picking songs rather than for a log.
export function describeStep(
  candidateYear: number | null | undefined,
  comparisonYear: number | null | undefined,
  range: YearRange
): string | null {
  if (isValidStep(candidateYear, comparisonYear, range)) return null;

  const { minYears, maxYears } = normaliseRange(range);
  if (maxYears < minYears) return `Min years (${minYears}) is above max years (${maxYears}).`;
  if (!Number.isFinite(candidateYear)) return "No release year for this song.";
  if (candidateYear === comparisonYear) {
    return `Released in ${comparisonYear} - the same year it would be compared against.`;
  }
  return `Needs to be ${minYears}-${maxYears} years from ${comparisonYear}.`;
}

// The comparison year for each position: the seed first, then each song's
// predecessor. Feeds the sheet preview, the insert and the repair alike.
export function chainHintYears(years: number[], seedYear: number): number[] {
  return years.map((_, i) => (i === 0 ? seedYear : years[i - 1]));
}

export function stepDirection(releaseYear: number, comparisonYear: number): "Higher" | "Lower" {
  return releaseYear > comparisonYear ? "Higher" : "Lower";
}

// Walks the pool for the longest run of songs that can each follow the last,
// preferring to flip direction at every step so the round is a genuine mix
// rather than a march in one direction. Returns fewer than `limit` when the pool
// simply cannot reach that far - a short chain is a real answer, and the caller
// says so rather than padding it.
export function buildChain<T extends { year: number }>(
  pool: T[],
  seedYear: number,
  range: YearRange,
  limit: number
): { picked: T[]; hintYears: number[] } {
  const empty = { picked: [] as T[], hintYears: [] as number[] };
  if (limit <= 0 || !pool.length || !Number.isFinite(seedYear)) return empty;

  const used = new Set<number>();
  const current: T[] = [];
  let best: T[] = [];
  let steps = 0;

  const search = (comparisonYear: number) => {
    if (current.length > best.length) best = [...current];
    if (current.length >= limit || steps >= SEARCH_BUDGET) return;

    const preferHigher = current.length % 2 === 0;
    const candidates = pool
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => !used.has(index) && isValidStep(item.year, comparisonYear, range))
      .sort((a, b) => {
        const aWanted = a.item.year > comparisonYear === preferHigher;
        const bWanted = b.item.year > comparisonYear === preferHigher;
        if (aWanted !== bWanted) return aWanted ? -1 : 1;
        return a.index - b.index;
      });

    for (const candidate of candidates) {
      steps++;
      used.add(candidate.index);
      current.push(candidate.item);

      search(candidate.item.year);
      if (best.length >= limit) return;

      current.pop();
      used.delete(candidate.index);
    }
  };

  search(seedYear);

  const picked = best.slice(0, limit);
  return { picked, hintYears: chainHintYears(picked.map((p) => p.year), seedYear) };
}
