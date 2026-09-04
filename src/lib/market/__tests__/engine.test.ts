import { describe, expect, it } from "vitest";
import { runTick, tickInstrument } from "../engine";
import { DEFAULT_MARKET_CONFIG, type InstrumentState, type TickInputs } from "../types";
import { tickRng } from "../rng";

function instrument(overrides: Partial<InstrumentState> = {}): InstrumentState {
  return {
    id: 1,
    basePrice: 5,
    currentPrice: 5,
    lastNotifiedPrice: 5,
    demandUnits: 0,
    stockState: "ok",
    stockOverride: null,
    squareVariationId: "VAR1",
    ...overrides,
  };
}

function inputs(overrides: Partial<TickInputs> = {}): TickInputs {
  return {
    config: DEFAULT_MARKET_CONFIG,
    crashActive: false,
    newUnitsByInstrument: new Map(),
    stockQtyByVariation: new Map(),
    rng: tickRng(1, 1),
    ...overrides,
  };
}

describe("tickInstrument pricing", () => {
  it("is deterministic for the same rng seed", () => {
    const a = tickInstrument(instrument(), inputs({ rng: tickRng(9, 4) }));
    const b = tickInstrument(instrument(), inputs({ rng: tickRng(9, 4) }));
    expect(a).toEqual(b);
  });

  it("rounds to the configured step", () => {
    const result = tickInstrument(instrument(), inputs());
    const steps = Math.round(result.price / DEFAULT_MARKET_CONFIG.roundStep);
    expect(result.price).toBeCloseTo(steps * DEFAULT_MARKET_CONFIG.roundStep, 10);
  });

  it("never leaves the floor/ceiling band", () => {
    for (let tick = 1; tick <= 200; tick++) {
      const heavy = tickInstrument(
        instrument({ currentPrice: 7.5 }),
        inputs({ rng: tickRng(2, tick), newUnitsByInstrument: new Map([[1, 50]]) })
      );
      expect(heavy.price).toBeLessThanOrEqual(5 * DEFAULT_MARKET_CONFIG.ceilPct);
      const starved = tickInstrument(
        instrument({ currentPrice: 3.5 }),
        inputs({ rng: tickRng(3, tick) })
      );
      expect(starved.price).toBeGreaterThanOrEqual(5 * DEFAULT_MARKET_CONFIG.floorPct);
    }
  });

  it("demand pushes the price above the no-demand path", () => {
    const quiet = tickInstrument(instrument(), inputs({ rng: tickRng(5, 1) }));
    const busy = tickInstrument(
      instrument(),
      inputs({ rng: tickRng(5, 1), newUnitsByInstrument: new Map([[1, 40]]) })
    );
    expect(busy.price).toBeGreaterThan(quiet.price);
  });

  it("reversion pulls an inflated price back toward base over ticks", () => {
    const config = { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0 };
    let current = 7;
    for (let tick = 1; tick <= 40; tick++) {
      const result = tickInstrument(
        instrument({ currentPrice: current }),
        inputs({ config, rng: () => 0.5 })
      );
      current = result.price;
    }
    expect(current).toBeLessThan(7);
    expect(current).toBeGreaterThanOrEqual(5 * config.floorPct);
  });

  it("decays demand each tick and adds new units", () => {
    const result = tickInstrument(
      instrument({ demandUnits: 10 }),
      inputs({ newUnitsByInstrument: new Map([[1, 4]]) })
    );
    expect(result.demandUnits).toBeCloseTo(10 * DEFAULT_MARKET_CONFIG.decayK + 4, 3);
  });

  it("a crash drags the price toward the crash floor", () => {
    const config = { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0 };
    let current = 7;
    for (let tick = 1; tick <= config.crashDurationTicks; tick++) {
      current = tickInstrument(
        instrument({ currentPrice: current }),
        inputs({ config, crashActive: true, rng: () => 0.5 })
      ).price;
    }
    expect(current).toBeLessThan(5);
    expect(current).toBeGreaterThanOrEqual(5 * config.floorPct);
  });
});

describe("stock states", () => {
  it("derives out/low/ok from inventory quantity", () => {
    const out = tickInstrument(
      instrument(),
      inputs({ stockQtyByVariation: new Map([["VAR1", 0]]) })
    );
    expect(out.stockState).toBe("out");
    const low = tickInstrument(
      instrument(),
      inputs({ stockQtyByVariation: new Map([["VAR1", 3]]) })
    );
    expect(low.stockState).toBe("low");
    const ok = tickInstrument(
      instrument(),
      inputs({ stockQtyByVariation: new Map([["VAR1", 30]]) })
    );
    expect(ok.stockState).toBe("ok");
  });

  it("keeps the previous state when inventory is unknown this tick", () => {
    const result = tickInstrument(instrument({ stockState: "low" }), inputs());
    expect(result.stockState).toBe("low");
  });

  it("manual override beats inventory", () => {
    const result = tickInstrument(
      instrument({ stockOverride: "out" }),
      inputs({ stockQtyByVariation: new Map([["VAR1", 100]]) })
    );
    expect(result.stockState).toBe("out");
  });

  it("freezes the price while sold out", () => {
    const result = tickInstrument(
      instrument({ currentPrice: 6.15, stockOverride: "out" }),
      inputs({ newUnitsByInstrument: new Map([[1, 50]]) })
    );
    expect(result.price).toBe(6.15);
  });

  it("emits transition events", () => {
    const toLow = tickInstrument(
      instrument(),
      inputs({ stockQtyByVariation: new Map([["VAR1", 2]]) })
    );
    expect(toLow.events.map((e) => e.kind)).toContain("low_stock");

    const toOut = tickInstrument(
      instrument({ stockState: "low" }),
      inputs({ stockQtyByVariation: new Map([["VAR1", 0]]) })
    );
    expect(toOut.events.map((e) => e.kind)).toContain("out_of_stock");

    const back = tickInstrument(
      instrument({ stockState: "out" }),
      inputs({ stockQtyByVariation: new Map([["VAR1", 20]]) })
    );
    expect(back.events.map((e) => e.kind)).toContain("restock");
  });

  it("does not emit when the state is unchanged", () => {
    const result = tickInstrument(
      instrument({ stockState: "low" }),
      inputs({ stockQtyByVariation: new Map([["VAR1", 4]]) })
    );
    expect(result.events.filter((e) => e.kind === "low_stock")).toHaveLength(0);
  });
});

describe("move alerts", () => {
  const config = { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0, reversionK: 0.2 };

  it("fires price_drop once the cumulative slide crosses the threshold", () => {
    let state = instrument({ currentPrice: 6.5, lastNotifiedPrice: 6.5 });
    const kinds: string[] = [];
    for (let tick = 1; tick <= 10; tick++) {
      const result = tickInstrument(state, inputs({ config, rng: () => 0.5 }));
      kinds.push(...result.events.map((e) => e.kind));
      state = {
        ...state,
        currentPrice: result.price,
        lastNotifiedPrice: result.lastNotifiedPrice,
      };
    }
    expect(kinds).toContain("price_drop");
  });

  it("resets the anchor so the same drop is not re-alerted", () => {
    const result = tickInstrument(
      instrument({ currentPrice: 6.5, lastNotifiedPrice: 6.5 }),
      inputs({ config, rng: () => 0.5 })
    );
    if (result.events.some((e) => e.kind === "price_drop")) {
      expect(result.lastNotifiedPrice).toBe(result.price);
    }
    const again = tickInstrument(
      instrument({
        currentPrice: result.price,
        lastNotifiedPrice: result.lastNotifiedPrice,
      }),
      inputs({
        config: { ...config, reversionK: 0 },
        rng: () => 0.5,
      })
    );
    expect(again.events.filter((e) => e.kind === "price_drop")).toHaveLength(0);
  });

  it("fires surge on a strong demand run", () => {
    const surgeConfig = { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0, demandK: 0.08 };
    const result = tickInstrument(
      instrument(),
      inputs({
        config: surgeConfig,
        rng: () => 0.5,
        newUnitsByInstrument: new Map([[1, 60]]),
      })
    );
    expect(result.events.map((e) => e.kind)).toContain("surge");
    expect(result.lastNotifiedPrice).toBe(result.price);
  });
});

describe("runTick", () => {
  it("ticks every instrument independently", () => {
    const results = runTick(
      [instrument({ id: 1 }), instrument({ id: 2, squareVariationId: null })],
      inputs({ newUnitsByInstrument: new Map([[1, 10]]) })
    );
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("per-drink overrides", () => {
  it("clamps to absolute min/max prices instead of the config band", () => {
    for (let tick = 1; tick <= 100; tick++) {
      const capped = tickInstrument(
        instrument({ currentPrice: 5.5, maxPrice: 5.5 }),
        inputs({ rng: tickRng(4, tick), newUnitsByInstrument: new Map([[1, 50]]) })
      );
      expect(capped.price).toBeLessThanOrEqual(5.5);
      const floored = tickInstrument(
        instrument({ currentPrice: 4.5, minPrice: 4.5 }),
        inputs({ rng: tickRng(6, tick) })
      );
      expect(floored.price).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the drink's low stock threshold over the config one", () => {
    const stock = new Map([["VAR1", 8]]);
    const byConfig = tickInstrument(instrument(), inputs({ stockQtyByVariation: stock }));
    expect(byConfig.stockState).toBe("ok");
    const byDrink = tickInstrument(
      instrument({ lowStockAt: 10 }),
      inputs({ stockQtyByVariation: stock })
    );
    expect(byDrink.stockState).toBe("low");
  });

  it("pulls toward the drink's crash price during a crash", () => {
    const result = tickInstrument(
      instrument({ crashPrice: 3.5, minPrice: 3.5 }),
      inputs({
        crashActive: true,
        config: { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0 },
        rng: tickRng(7, 1),
      })
    );
    expect(result.price).toBeLessThan(5);
    expect(result.price).toBeGreaterThanOrEqual(3.5);
  });
});

describe("single-drink crash and manual sold out", () => {
  it("crashes only the flagged instrument", () => {
    const config = { ...DEFAULT_MARKET_CONFIG, noiseSigma: 0 };
    const [crashed, steady] = runTick(
      [instrument({ id: 1, crashActive: true }), instrument({ id: 2 })],
      inputs({ config, rng: tickRng(8, 1) })
    );
    expect(crashed.price).toBeLessThan(5);
    expect(steady.price).toBe(5);
  });

  it("freezes the price the same tick a sold-out override is set", () => {
    const result = tickInstrument(
      instrument({ currentPrice: 5.35, stockState: "ok", stockOverride: "out" }),
      inputs({ newUnitsByInstrument: new Map([[1, 40]]) })
    );
    expect(result.price).toBe(5.35);
    expect(result.stockState).toBe("out");
  });
});
