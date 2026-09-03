import { describe, it, expect } from "vitest";
import {
  isValidStep,
  describeStep,
  chainHintYears,
  stepDirection,
  stepAnswerText,
  buildChain,
  legalYearWindows,
  formatYearWindows,
  type YearRange,
} from "@/lib/quiz/higher-lower";

const RANGE: YearRange = { minYears: 3, maxYears: 10 };

function song(year: number, title = `Song ${year}`) {
  return { year, title };
}

describe("isValidStep", () => {
  it("accepts a gap exactly on the minimum", () => {
    expect(isValidStep(1993, 1990, RANGE)).toBe(true);
    expect(isValidStep(1987, 1990, RANGE)).toBe(true);
  });

  it("accepts a gap exactly on the maximum", () => {
    expect(isValidStep(2000, 1990, RANGE)).toBe(true);
    expect(isValidStep(1980, 1990, RANGE)).toBe(true);
  });

  it("rejects a gap below the minimum", () => {
    expect(isValidStep(1992, 1990, RANGE)).toBe(false);
  });

  it("rejects a gap above the maximum", () => {
    expect(isValidStep(2001, 1990, RANGE)).toBe(false);
  });

  it("rejects the same year even when minYears is 0", () => {
    expect(isValidStep(1990, 1990, { minYears: 0, maxYears: 10 })).toBe(false);
  });

  it("rejects the same year even when minYears is negative", () => {
    expect(isValidStep(1990, 1990, { minYears: -5, maxYears: 10 })).toBe(false);
  });

  it("rejects everything when min is above max", () => {
    expect(isValidStep(1995, 1990, { minYears: 10, maxYears: 3 })).toBe(false);
  });

  it("rejects a missing year on either side", () => {
    expect(isValidStep(null, 1990, RANGE)).toBe(false);
    expect(isValidStep(1995, undefined, RANGE)).toBe(false);
  });
});

describe("describeStep", () => {
  it("says nothing when the step is legal", () => {
    expect(describeStep(1995, 1990, RANGE)).toBeNull();
  });

  it("calls out a song released in the comparison year", () => {
    expect(describeStep(1990, 1990, RANGE)).toBe(
      "Released in 1990 - the same year it would be compared against."
    );
  });

  it("gives the allowed window when the gap is wrong", () => {
    expect(describeStep(1992, 1990, RANGE)).toBe("Needs to be 3-10 years from 1990.");
  });

  it("reports an impossible range rather than blaming the song", () => {
    expect(describeStep(1995, 1990, { minYears: 10, maxYears: 3 })).toBe(
      "Min years (10) is above max years (3)."
    );
  });
});

describe("chainHintYears", () => {
  it("compares the first song against the seed and the rest against their predecessor", () => {
    expect(chainHintYears([1994, 1988, 1997], 1990)).toEqual([1990, 1994, 1988]);
  });

  it("handles an empty round", () => {
    expect(chainHintYears([], 1990)).toEqual([]);
  });
});

describe("stepDirection", () => {
  it("reads Higher when the release year is above the comparison year", () => {
    expect(stepDirection(1994, 1990)).toBe("Higher");
  });

  it("reads Lower when it is below", () => {
    expect(stepDirection(1986, 1990)).toBe("Lower");
  });
});

describe("stepAnswerText", () => {
  it("reads as the host says it, direction then release year", () => {
    expect(stepAnswerText(2002, 2000)).toBe("Higher - released 2002");
    expect(stepAnswerText(1998, 2000)).toBe("Lower - released 1998");
  });
});

describe("legalYearWindows", () => {
  it("gives a run of years either side of the comparison year", () => {
    expect(legalYearWindows(1990, RANGE, 2026)).toEqual({
      lower: { from: 1980, to: 1987 },
      higher: { from: 1993, to: 2000 },
    });
  });

  it("cuts the upper run off at the current year", () => {
    expect(legalYearWindows(2020, RANGE, 2026).higher).toEqual({ from: 2023, to: 2026 });
  });

  it("drops the upper run when it would start in the future", () => {
    expect(legalYearWindows(2025, RANGE, 2026).higher).toBeNull();
  });

  it("never lets the run touch the comparison year itself", () => {
    const windows = legalYearWindows(1990, { minYears: 0, maxYears: 5 }, 2026);
    expect(windows.lower.to).toBe(1989);
    expect(windows.higher?.from).toBe(1991);
  });
});

describe("formatYearWindows", () => {
  it("reads as two ranges joined by or", () => {
    expect(formatYearWindows(legalYearWindows(1990, RANGE, 2026))).toBe("1980-1987 or 1993-2000");
  });

  it("collapses a single-year run to the year alone", () => {
    expect(formatYearWindows(legalYearWindows(2023, RANGE, 2026))).toBe("2013-2020 or 2026");
  });

  it("leaves out the upper run when there is none", () => {
    expect(formatYearWindows(legalYearWindows(2025, RANGE, 2026))).toBe("2015-2022");
  });
});

describe("buildChain", () => {
  it("returns nothing when no song in the pool can follow the seed", () => {
    const pool = [song(1991), song(1990), song(1992)];
    expect(buildChain(pool, 1990, RANGE, 5).picked).toEqual([]);
  });

  it("never picks a song released in the seed year", () => {
    const pool = [song(1990)];
    expect(buildChain(pool, 1990, { minYears: 0, maxYears: 10 }, 3).picked).toEqual([]);
  });

  it("finds the single valid chain when only one exists", () => {
    const pool = [song(1994), song(1991), song(2050)];
    const { picked } = buildChain(pool, 1990, RANGE, 1);
    expect(picked.map((p) => p.year)).toEqual([1994]);
  });

  it("keeps every step inside the range and gives back matching hint years", () => {
    const pool = [song(1994), song(1986), song(1996), song(1988), song(1998), song(2004)];
    const { picked, hintYears } = buildChain(pool, 1990, RANGE, 5);

    expect(picked).toHaveLength(5);
    expect(hintYears).toHaveLength(5);
    expect(hintYears[0]).toBe(1990);

    picked.forEach((p, i) => {
      expect(isValidStep(p.year, hintYears[i], RANGE)).toBe(true);
      if (i > 0) expect(hintYears[i]).toBe(picked[i - 1].year);
    });
  });

  it("mixes directions rather than marching upwards", () => {
    const pool = [song(1994), song(1986), song(1996), song(1988), song(1998), song(2004)];
    const { picked, hintYears } = buildChain(pool, 1990, RANGE, 5);
    const directions = picked.map((p, i) => stepDirection(p.year, hintYears[i]));

    expect(directions).toContain("Higher");
    expect(directions).toContain("Lower");
  });

  it("never repeats a song", () => {
    const pool = [song(1994), song(1986), song(1996), song(1988), song(1998)];
    const { picked } = buildChain(pool, 1990, RANGE, 5);
    expect(new Set(picked.map((p) => p.title)).size).toBe(picked.length);
  });

  it("returns the longest chain it can reach when the pool runs out", () => {
    const pool = [song(1994), song(1998)];
    const { picked } = buildChain(pool, 1990, RANGE, 6);
    expect(picked.map((p) => p.year)).toEqual([1994, 1998]);
  });

  it("stops at the limit even when the pool could go further", () => {
    const pool = [song(1994), song(1986), song(1996), song(1988), song(1998), song(2004)];
    expect(buildChain(pool, 1990, RANGE, 3).picked).toHaveLength(3);
  });

  it("returns nothing for a non-positive limit or an empty pool", () => {
    expect(buildChain([song(1994)], 1990, RANGE, 0).picked).toEqual([]);
    expect(buildChain([], 1990, RANGE, 5).picked).toEqual([]);
  });
});
