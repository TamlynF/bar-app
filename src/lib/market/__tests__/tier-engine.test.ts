import { describe, expect, it } from "vitest";
import { clamp, instrumentLimits, roundToStep } from "../engine";
import {
  minutesSinceSale,
  paceOf,
  rankInstruments,
  rankValue,
  runTierTick,
  shouldRerank,
  tierPctFor,
  type TierSessionState,
  type TierTickInputs,
} from "../tier-engine";
import { DEFAULT_MARKET_CONFIG, resolveMarketConfig, type InstrumentState, type MarketConfig } from "../types";
import fixture from "./fixtures/tier-night.fixture.json";

const tiers = DEFAULT_MARKET_CONFIG.tierPcts;

function instrument(overrides: Partial<InstrumentState> = {}): InstrumentState {
  return {
    id: 1,
    basePrice: 5,
    currentPrice: 5,
    lastNotifiedPrice: 5,
    demandUnits: 0,
    stockState: "ok",
    stockOverride: null,
    squareVariationId: null,
    normalUnitsPerNight: 15,
    lastSaleTick: null,
    tierPct: 0,
    ...overrides,
  };
}

function session(overrides: Partial<TierSessionState> = {}): TierSessionState {
  return { tickNo: 1, unitsSoldTotal: 0, warmedUpTick: null, lastRerankTick: null, ...overrides };
}

function inputs(config: MarketConfig, overrides: Partial<TierTickInputs> = {}): TierTickInputs {
  return {
    config,
    crashActive: false,
    newUnitsByInstrument: new Map(),
    stockQtyByVariation: new Map(),
    rng: () => 0.5,
    session: session(),
    ...overrides,
  };
}

const warm = resolveMarketConfig({ ...DEFAULT_MARKET_CONFIG, pricingMode: "tiers", warmupUnits: 0, sessionTicksHint: 15 });

describe("golden replay of the workbook night (tab 10)", () => {
  const config = resolveMarketConfig({ ...DEFAULT_MARKET_CONFIG, ...fixture.config });

  it("reproduces every rank, tier and target, and only moves prices on update ticks", () => {
    let states: InstrumentState[] = fixture.drinks.map((d) => ({
      id: d.id,
      basePrice: d.basePrice,
      currentPrice: d.basePrice,
      lastNotifiedPrice: d.basePrice,
      demandUnits: 0,
      stockState: "ok",
      stockOverride: null,
      squareVariationId: null,
      normalUnitsPerNight: d.normalUnitsPerNight,
      lastSaleTick: null,
      tierPct: 0,
    }));
    let sess = session({ tickNo: 0 });
    let comparedPrices = 0;

    for (let tick = 1; tick <= fixture.session.length; tick++) {
      const units = new Map(fixture.drinks.map((d) => [d.id, d.units[tick - 1]] as const));
      const outcome = runTierTick(states, inputs(config, { newUnitsByInstrument: units, session: { ...sess, tickNo: tick } }));

      const expectedSession = fixture.session[tick - 1];
      expect(outcome.session.unitsSoldTotal, `tick ${tick} units total`).toBe(expectedSession.unitsSoldTotal);
      expect(outcome.session.warmedUpTick != null, `tick ${tick} warmed`).toBe(expectedSession.warmedUp);
      expect(outcome.reranked, `tick ${tick} reranked`).toBe(expectedSession.reranked);

      for (const drink of fixture.drinks) {
        const result = outcome.results.find((r) => r.id === drink.id)!;
        const expected = drink.expected[tick - 1];
        const label = `${drink.name} tick ${tick}`;
        expect(result.demandUnits, `${label} heat`).toBeCloseTo(expected.heat, 3);
        expect(result.pace, `${label} pace`).toBeCloseTo(expected.pace, 2);
        expect(result.rankPos, `${label} rank`).toBe(expected.rank);
        expect(result.tierPct, `${label} tier`).toBeCloseTo(expected.tierPct, 9);
        expect(result.targetPrice, `${label} target`).toBeCloseTo(drink.basePrice * (1 + expected.tierPct), 6);
        const before = states.find((s) => s.id === drink.id)!.currentPrice;
        const limits = instrumentLimits({ basePrice: drink.basePrice }, config);
        const expectedPrice = outcome.reranked
          ? roundToStep(clamp(result.targetPrice, limits.floor, limits.ceil), config.roundStep)
          : before;
        expect(result.price, `${label} price`).toBeCloseTo(expectedPrice, 9);
        comparedPrices += 1;
      }

      states = states.map((s) => {
        const r = outcome.results.find((x) => x.id === s.id)!;
        return {
          ...s,
          currentPrice: r.price,
          lastNotifiedPrice: r.lastNotifiedPrice,
          demandUnits: r.demandUnits,
          stockState: r.stockState,
          lastSaleTick: r.lastSaleTick,
          tierPct: r.tierPct,
        };
      });
      sess = outcome.session;
    }

    expect(comparedPrices).toBe(42 * 15);
  });
});

describe("pace", () => {
  it("is heat divided by the drink's normal units per tick", () => {
    expect(paceOf(1, 22, { ...warm, sessionTicksHint: 15 })).toBeCloseTo(0.682, 3);
    expect(paceOf(1, 8, { ...warm, sessionTicksHint: 15 })).toBeCloseTo(1.875, 3);
  });

  it("floors a rare drink's normal so one sale cannot read as 15x", () => {
    expect(paceOf(1, 1, { ...warm, sessionTicksHint: 15 })).toBeCloseTo(1.875, 3);
    expect(paceOf(1, null, { ...warm, sessionTicksHint: 15 })).toBeCloseTo(1.875, 3);
  });
});

describe("ranking and tie-breaks", () => {
  it("ranks by pace, then recency, then base price, then id", () => {
    expect(minutesSinceSale(null, 7)).toBe(99);
    expect(minutesSinceSale(4, 7)).toBe(3);
    const recent = rankValue(1, 0, 4);
    const stale = rankValue(1, 5, 4);
    const dearer = rankValue(1, 5, 9);
    expect(recent).toBeGreaterThan(stale);
    expect(dearer).toBeGreaterThan(stale);
    expect(rankValue(1.001, 99, 1)).toBeGreaterThan(recent);
    const ranks = rankInstruments([
      { id: 3, value: 1 },
      { id: 1, value: 1 },
      { id: 2, value: 2 },
    ]);
    expect(ranks.get(2)).toBe(1);
    expect(ranks.get(1)).toBe(2);
    expect(ranks.get(3)).toBe(3);
  });

  it("maps ranks to tiers with the discount winning when both lists overlap", () => {
    expect(tierPctFor(1, 42, tiers)).toBe(0.3);
    expect(tierPctFor(6, 42, tiers)).toBe(0.2);
    expect(tierPctFor(15, 42, tiers)).toBe(0.1);
    expect(tierPctFor(16, 42, tiers)).toBe(0);
    expect(tierPctFor(42, 42, tiers)).toBe(-0.3);
    expect(tierPctFor(28, 42, tiers)).toBe(-0.1);
    expect(tierPctFor(27, 42, tiers)).toBe(0);
    expect(tierPctFor(3, 10, tiers)).toBe(-0.2);
  });
});

describe("warm-up and re-rank cadence", () => {
  it("never re-ranks before warm-up, re-ranks on the warm-up tick and every Nth tick after", () => {
    expect(shouldRerank(5, null, 5)).toBe(false);
    expect(shouldRerank(4, 4, 5)).toBe(true);
    expect(shouldRerank(5, 4, 5)).toBe(true);
    expect(shouldRerank(6, 4, 5)).toBe(false);
    expect(shouldRerank(10, 4, 5)).toBe(true);
  });

  it("keeps every price at base until the warm-up units have sold", () => {
    const config = resolveMarketConfig({ ...warm, warmupUnits: 10 });
    const drinks = [instrument({ id: 1 }), instrument({ id: 2, basePrice: 9, currentPrice: 9, lastNotifiedPrice: 9 })];
    const first = runTierTick(drinks, inputs(config, { newUnitsByInstrument: new Map([[1, 6]]) }));
    expect(first.session.warmedUpTick).toBeNull();
    expect(first.results.every((r) => r.tierPct === 0)).toBe(true);
    expect(first.results.every((r) => r.price === r.id * 0 + (r.id === 1 ? 5 : 9))).toBe(true);
    const second = runTierTick(drinks, inputs(config, { newUnitsByInstrument: new Map([[1, 6]]), session: { ...first.session, tickNo: 2 } }));
    expect(second.session.warmedUpTick).toBe(2);
    expect(second.warmedUpThisTick).toBe(true);
    expect(second.reranked).toBe(true);
  });

  it("carries the previous tier between re-ranks even when the ranking changes", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 5 });
    const drinks = [instrument({ id: 1, tierPct: 0.3 }), instrument({ id: 2, tierPct: -0.3 })];
    const outcome = runTierTick(
      drinks,
      inputs(config, { newUnitsByInstrument: new Map([[2, 10]]), session: session({ tickNo: 7, warmedUpTick: 1, lastRerankTick: 5 }) })
    );
    expect(outcome.reranked).toBe(false);
    expect(outcome.results.find((r) => r.id === 1)!.tierPct).toBe(0.3);
    expect(outcome.results.find((r) => r.id === 2)!.tierPct).toBe(-0.3);
    expect(outcome.results.find((r) => r.id === 2)!.rankPos).toBe(1);
  });

  it("emits tier_up / tier_down only when a re-rank changes the tier", () => {
    const config = resolveMarketConfig({ ...warm, tierPcts: { down: [0.3], up: [0.3], bands: [1] } });
    const drinks = [instrument({ id: 1 }), instrument({ id: 2 }), instrument({ id: 3 })];
    const outcome = runTierTick(
      drinks,
      inputs(config, { newUnitsByInstrument: new Map([[2, 5]]), session: session({ tickNo: 5, warmedUpTick: 1 }) })
    );
    const kinds = outcome.results.map((r) => [r.id, r.events.map((e) => e.kind)] as const);
    expect(kinds.find(([id]) => id === 2)![1]).toContain("tier_up");
    expect(kinds.find(([id]) => id === 3)![1]).toContain("tier_down");
    expect(kinds.find(([id]) => id === 1)![1]).not.toContain("tier_down");
    expect(outcome.results.find((r) => r.id === 2)!.tierPct).toBe(0.3);
  });
});

describe("updates, rounding and limits", () => {
  it("jumps straight to the target on a re-rank and rounds to 5p", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 5, tierPcts: { down: [0.3], up: [0.3], bands: [1] } });
    const drink = instrument({ id: 1, basePrice: 9.95, currentPrice: 9.95, lastNotifiedPrice: 9.95 });
    const other = instrument({ id: 2, basePrice: 5, currentPrice: 5, lastNotifiedPrice: 5 });
    const outcome = runTierTick([drink, other], inputs(config, { newUnitsByInstrument: new Map([[2, 3]]), session: session({ tickNo: 5, warmedUpTick: 1 }) }));
    expect(outcome.reranked).toBe(true);
    const result = outcome.results.find((r) => r.id === 1)!;
    expect(result.targetPrice).toBeCloseTo(6.965, 6);
    expect(result.price).toBe(6.95);
    expect(outcome.results.find((r) => r.id === 2)!.price).toBe(6.5);
  });

  it("holds every price between re-ranks, even when the target is elsewhere", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 5, tierPcts: { down: [0.3], up: [0.3], bands: [1] } });
    const drink = instrument({ id: 1, basePrice: 9.95, currentPrice: 9.95, lastNotifiedPrice: 9.95, tierPct: -0.3 });
    const other = instrument({ id: 2, tierPct: 0.3 });
    for (const tickNo of [6, 7, 8, 9]) {
      const out = runTierTick([drink, other], inputs(config, { newUnitsByInstrument: new Map([[2, 3]]), session: session({ tickNo, warmedUpTick: 1 }) }));
      expect(out.reranked).toBe(false);
      const result = out.results.find((r) => r.id === 1)!;
      expect(result.price).toBe(9.95);
      expect(result.events).toEqual([]);
    }
  });

  it("holds the opening price through warm-up", () => {
    const config = resolveMarketConfig({ ...warm, warmupUnits: 100 });
    const drink = instrument({ id: 1, basePrice: 5, currentPrice: 4.5, lastNotifiedPrice: 4.5 });
    const out = runTierTick([drink, instrument({ id: 2 })], inputs(config, { newUnitsByInstrument: new Map([[1, 3]]) }));
    expect(out.results.find((r) => r.id === 1)!.price).toBe(4.5);
  });

  it("never leaves the floor/ceiling band and freezes a sold-out drink", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 100, tierPcts: { down: [0.9], up: [0.9], bands: [1] } });
    const cheap = instrument({ id: 1, tierPct: -0.9 });
    const dear = instrument({ id: 2, tierPct: 0.9 });
    const out = runTierTick([cheap, dear], inputs(config, { crashEnded: true, session: session({ tickNo: 3, warmedUpTick: 1 }) }));
    expect(out.results.find((r) => r.id === 1)!.price).toBe(3.5);
    expect(out.results.find((r) => r.id === 2)!.price).toBe(7.5);

    const soldOut = instrument({ id: 3, currentPrice: 6.2, stockOverride: "out", tierPct: -0.3 });
    const frozen = runTierTick([soldOut, dear], inputs(config, { crashEnded: true, session: session({ tickNo: 3, warmedUpTick: 1 }) }));
    expect(frozen.results.find((r) => r.id === 3)!.price).toBe(6.2);
  });
});

describe("crash", () => {
  it("drops to the crash price the tick it starts and restores the tier price the tick after it ends", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 100 });
    const drinks = [instrument({ id: 1, tierPct: 0.3, currentPrice: 6.5 }), instrument({ id: 2, tierPct: -0.3, currentPrice: 3.5 })];
    const crashed = runTierTick(drinks, inputs(config, { crashActive: true, session: session({ tickNo: 7, warmedUpTick: 1 }) }));
    expect(crashed.results.every((r) => r.targetPrice === 3.75)).toBe(true);
    expect(crashed.results.find((r) => r.id === 1)!.price).toBe(3.75);
    expect(crashed.results.find((r) => r.id === 1)!.tierPct).toBe(0.3);

    const atCrash = drinks.map((d) => ({ ...d, currentPrice: crashed.results.find((r) => r.id === d.id)!.price }));
    const recovered = runTierTick(atCrash, inputs(config, { crashEnded: true, session: session({ tickNo: 8, warmedUpTick: 1 }) }));
    expect(recovered.results.find((r) => r.id === 1)!.targetPrice).toBe(6.5);
    expect(recovered.results.find((r) => r.id === 1)!.price).toBe(6.5);

    const between = runTierTick(atCrash, inputs(config, { session: session({ tickNo: 9, warmedUpTick: 1 }) }));
    expect(between.results.find((r) => r.id === 1)!.price).toBe(3.75);
  });

  it("honours a per-drink crash", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 100 });
    const drinks = [instrument({ id: 1, tierPct: 0.3, currentPrice: 6.5, crashActive: true }), instrument({ id: 2, tierPct: 0, currentPrice: 5 })];
    const out = runTierTick(drinks, inputs(config, { session: session({ tickNo: 7, warmedUpTick: 1 }) }));
    expect(out.results.find((r) => r.id === 1)!.targetPrice).toBe(3.75);
    expect(out.results.find((r) => r.id === 1)!.price).toBe(3.75);
    expect(out.results.find((r) => r.id === 2)!.targetPrice).toBe(5);
    expect(out.results.find((r) => r.id === 2)!.price).toBe(5);
  });
});

describe("alerts", () => {
  it("fires a surge when an update moves the price 5% from the last alerted price and re-arms", () => {
    const config = resolveMarketConfig({ ...warm, rerankEveryTicks: 100 });
    const drink = instrument({ id: 1, tierPct: 0.3, currentPrice: 5.2, lastNotifiedPrice: 5 });
    const out = runTierTick([drink, instrument({ id: 2 })], inputs(config, { crashEnded: true, session: session({ tickNo: 7, warmedUpTick: 1 }) }));
    const result = out.results.find((r) => r.id === 1)!;
    expect(result.price).toBe(6.5);
    expect(result.events.map((e) => e.kind)).toContain("surge");
    expect(result.lastNotifiedPrice).toBe(6.5);
  });
});

describe("resolveMarketConfig with tier fields", () => {
  it("accepts the mode, the tier table and a zero warm-up, and falls back on junk", () => {
    const config = resolveMarketConfig({ pricingMode: "tiers", warmupUnits: 0, tierPcts: { down: [0.2], up: [0.1], bands: [3] }, glidePct: -1 });
    expect(config.pricingMode).toBe("tiers");
    expect(config.warmupUnits).toBe(0);
    expect(config.tierPcts).toEqual({ down: [0.2], up: [0.1], bands: [3] });
    expect(config.glidePct).toBe(DEFAULT_MARKET_CONFIG.glidePct);
    expect(resolveMarketConfig({ pricingMode: "bananas" }).pricingMode).toBe("demand");
    expect(resolveMarketConfig({ tierPcts: { down: "x" } }).tierPcts).toEqual(DEFAULT_MARKET_CONFIG.tierPcts);
  });
});
