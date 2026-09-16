import { describe, expect, it } from "vitest";
import {
  SIM_MAX_ROUND_SALES,
  isValidSaleUnits,
  mergeUnits,
  planBusyRound,
  sumPendingUnits,
} from "../simulate";

describe("sumPendingUnits", () => {
  it("sums numeric-as-string units per instrument and drops junk", () => {
    const map = sumPendingUnits([
      { instrument_id: 1, units: "2" },
      { instrument_id: 1, units: 3 },
      { instrument_id: 2, units: 1 },
      { instrument_id: 3, units: "nope" },
      { instrument_id: 4, units: 0 },
    ]);
    expect([...map.entries()]).toEqual([
      [1, 5],
      [2, 1],
    ]);
  });
});

describe("mergeUnits", () => {
  it("adds simulated units on top of till units without mutating either", () => {
    const till = new Map([[1, 2]]);
    const sim = new Map([
      [1, 3],
      [7, 1],
    ]);
    const merged = mergeUnits(till, sim);
    expect(merged.get(1)).toBe(5);
    expect(merged.get(7)).toBe(1);
    expect(till.get(1)).toBe(2);
  });
});

describe("planBusyRound", () => {
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("makes the requested number of 1-3 unit sales", () => {
    const plan = planBusyRound([{ id: 1 }, { id: 2 }], { sales: 5, rng: seq([0.1, 0.9]) });
    expect(plan).toHaveLength(5);
    for (const sale of plan) {
      expect([1, 2]).toContain(sale.instrumentId);
      expect(sale.units).toBeGreaterThanOrEqual(1);
      expect(sale.units).toBeLessThanOrEqual(3);
    }
  });

  it("skips sold-out drinks and returns nothing when none can trade", () => {
    expect(planBusyRound([{ id: 1, soldOut: true }], { sales: 3 })).toEqual([]);
    const plan = planBusyRound([{ id: 1, soldOut: true }, { id: 2 }], { sales: 4, rng: seq([0.99]) });
    expect(plan.every((sale) => sale.instrumentId === 2)).toBe(true);
  });

  it("weights the favourite 3x in the pool", () => {
    /* Pool is [1,1,1,2]; rng values below 0.75 land on the favourite. */
    const plan = planBusyRound([{ id: 1 }, { id: 2 }], {
      sales: 4,
      favouriteId: 1,
      rng: seq([0.0, 0.5, 0.5, 0.5, 0.74, 0.5, 0.76, 0.5]),
    });
    expect(plan.map((sale) => sale.instrumentId)).toEqual([1, 1, 1, 2]);
  });

  it("caps a round at SIM_MAX_ROUND_SALES", () => {
    expect(planBusyRound([{ id: 1 }], { sales: 999 })).toHaveLength(SIM_MAX_ROUND_SALES);
  });
});

describe("isValidSaleUnits", () => {
  it("accepts whole numbers 1..50 only", () => {
    expect(isValidSaleUnits(1)).toBe(true);
    expect(isValidSaleUnits(50)).toBe(true);
    expect(isValidSaleUnits(0)).toBe(false);
    expect(isValidSaleUnits(51)).toBe(false);
    expect(isValidSaleUnits(2.5)).toBe(false);
    expect(isValidSaleUnits("3")).toBe(false);
  });
});
