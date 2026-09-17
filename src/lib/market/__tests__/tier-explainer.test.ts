import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_CONFIG, type MarketConfig } from "../types";
import {
  gapClosedPct,
  heatDecaySeries,
  paceBreakdown,
  priceWalk,
  rankExample,
  ticksUntilRerank,
  tierBandRows,
  tierPctForRank,
} from "../tier-explainer";

const config: MarketConfig = { ...DEFAULT_MARKET_CONFIG, pricingMode: "tiers", sessionTicksHint: 15 };

describe("heatDecaySeries", () => {
  it("fades a one-off rush and settles a steady seller", () => {
    const rush = heatDecaySeries([5, 0, 0, 0], 0.6);
    expect(rush.map((step) => step.heat)).toEqual([5, 3, 1.8, 1.08]);

    const steady = heatDecaySeries(Array(20).fill(2), 0.6);
    expect(steady[steady.length - 1].heat).toBeCloseTo(5, 1);
  });
});

describe("paceBreakdown", () => {
  it("measures heat against the drink's own normal night", () => {
    const busy = paceBreakdown(2, 12, config);
    expect(busy.normalPerTick).toBeCloseTo(0.8, 3);
    expect(busy.pace).toBeCloseTo(2.5, 2);
    expect(busy.floorApplied).toBe(false);

    const quiet = paceBreakdown(2, 40, config);
    expect(quiet.pace).toBeLessThan(busy.pace);
  });

  it("floors a rare drink so one sale is not a stampede", () => {
    const raw = paceBreakdown(1, 1, config);
    expect(raw.floorApplied).toBe(true);
    expect(raw.usedPerNight).toBe(config.paceFloorUnits);
    expect(raw.pace).toBeCloseTo(15 / config.paceFloorUnits, 2);
  });

  it("matches the engine's own pace for the same inputs", () => {
    expect(paceBreakdown(3.2, 12, config).pace).toBe(
      rankExample("x", 3.2, 12, 5, config).pace.pace
    );
  });
});

describe("tierBandRows", () => {
  it("turns cumulative bands into readable ranges", () => {
    const rows = tierBandRows(config);
    expect(rows.map((row) => row.band)).toEqual(["1–5", "6–10", "11–15"]);
    expect(rows[0].up).toBe(0.3);
    expect(rows[2].down).toBe(0.1);
  });

  it("reads the same tier the engine would give that rank", () => {
    expect(tierPctForRank(1, 42, config)).toBe(0.3);
    expect(tierPctForRank(42, 42, config)).toBe(-0.3);
    expect(tierPctForRank(20, 42, config)).toBe(0);
  });
});

describe("priceWalk", () => {
  it("closes part of the gap each tick without overshooting", () => {
    const walk = priceWalk(5, 5, 6.5, config, 5);
    expect(walk[0].price).toBe(5);
    const prices = walk.map((step) => step.price);
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
      expect(prices[i]).toBeLessThanOrEqual(6.5);
    }
    expect(walk[walk.length - 1].gap).toBeLessThan(0.3);
  });

  it("never walks past the floor or the ceiling", () => {
    const belowFloor = priceWalk(5, 5, 1, config, 10);
    expect(belowFloor[belowFloor.length - 1].price).toBeGreaterThanOrEqual(5 * config.floorPct);

    const aboveCeiling = priceWalk(5, 5, 99, config, 10);
    expect(aboveCeiling[aboveCeiling.length - 1].price).toBeLessThanOrEqual(5 * config.ceilPct);
  });

  it("rounds every step to a payable amount", () => {
    for (const step of priceWalk(4.75, 4.75, 6.18, config, 6)) {
      expect(Math.round((step.price * 100) % (config.roundStep * 100))).toBe(0);
    }
  });
});

describe("gapClosedPct", () => {
  it("works out how far a glide gets in a few ticks", () => {
    expect(gapClosedPct(0.35, 5)) .toBe(88);
    expect(gapClosedPct(1, 1)).toBe(100);
  });
});

describe("ticksUntilRerank", () => {
  it("counts down to the next multiple", () => {
    expect(ticksUntilRerank(10, 5)).toBe(5);
    expect(ticksUntilRerank(11, 5)).toBe(4);
    expect(ticksUntilRerank(14, 5)).toBe(1);
  });
});
