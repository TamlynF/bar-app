import { describe, expect, it } from "vitest";
import { clamp, instrumentLimits, moveAlert, nextStockState, roundToStep, stockEvent } from "../engine";
import { DEFAULT_MARKET_CONFIG, type InstrumentState } from "../types";

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

const config = DEFAULT_MARKET_CONFIG;

describe("rounding and clamping", () => {
  it("rounds to the configured step", () => {
    expect(roundToStep(4.97, 0.05)).toBe(4.95);
    expect(roundToStep(4.98, 0.05)).toBe(5);
  });

  it("holds a value inside the band", () => {
    expect(clamp(2, 3.5, 7.5)).toBe(3.5);
    expect(clamp(9, 3.5, 7.5)).toBe(7.5);
    expect(clamp(5, 3.5, 7.5)).toBe(5);
  });
});

describe("instrument limits", () => {
  it("uses the config multipliers against the base price", () => {
    const limits = instrumentLimits(instrument(), config);
    expect(limits.floor).toBeCloseTo(5 * config.floorPct, 9);
    expect(limits.ceil).toBeCloseTo(5 * config.ceilPct, 9);
    expect(limits.crashTarget).toBeCloseTo(5 * config.crashFactor, 9);
  });

  it("prefers the drink's own limits", () => {
    const limits = instrumentLimits(
      instrument({ minPrice: 4.5, maxPrice: 5.5, crashPrice: 3, lowStockAt: 10, alertThreshold: 0.2 }),
      config
    );
    expect(limits).toMatchObject({ floor: 4.5, ceil: 5.5, crashTarget: 3, lowStockAt: 10, moveNotifyPct: 0.2 });
  });
});

describe("stock states", () => {
  it("derives out/low/ok from inventory quantity", () => {
    expect(nextStockState(instrument(), config, new Map([["VAR1", 0]]))).toBe("out");
    expect(nextStockState(instrument(), config, new Map([["VAR1", 3]]))).toBe("low");
    expect(nextStockState(instrument(), config, new Map([["VAR1", 30]]))).toBe("ok");
  });

  it("keeps the previous state when inventory is unknown this tick", () => {
    expect(nextStockState(instrument({ stockState: "low" }), config, new Map())).toBe("low");
  });

  it("manual override beats inventory", () => {
    expect(nextStockState(instrument({ stockOverride: "out" }), config, new Map([["VAR1", 100]]))).toBe("out");
  });

  it("uses the drink's low stock threshold over the config one", () => {
    const stock = new Map([["VAR1", 8]]);
    expect(nextStockState(instrument(), config, stock)).toBe("ok");
    expect(nextStockState(instrument({ lowStockAt: 10 }), config, stock)).toBe("low");
  });

  it("names each transition", () => {
    expect(stockEvent("ok", "low")).toBe("low_stock");
    expect(stockEvent("low", "out")).toBe("out_of_stock");
    expect(stockEvent("out", "ok")).toBe("restock");
    expect(stockEvent("out", "low")).toBe("restock");
    expect(stockEvent("low", "low")).toBeNull();
    expect(stockEvent("low", "ok")).toBeNull();
  });
});

describe("move alerts", () => {
  it("fires price_drop once the move from the last alerted price crosses the threshold", () => {
    const result = moveAlert(instrument({ currentPrice: 5, lastNotifiedPrice: 5 }), 4.7, 0.05);
    expect(result.event?.kind).toBe("price_drop");
    expect(result.lastNotifiedPrice).toBe(4.7);
  });

  it("fires surge on a rise past the threshold", () => {
    const result = moveAlert(instrument({ currentPrice: 5, lastNotifiedPrice: 5 }), 5.3, 0.05);
    expect(result.event?.kind).toBe("surge");
    expect(result.lastNotifiedPrice).toBe(5.3);
  });

  it("stays quiet under the threshold and keeps the anchor", () => {
    const result = moveAlert(instrument({ currentPrice: 5, lastNotifiedPrice: 5 }), 4.9, 0.05);
    expect(result.event).toBeNull();
    expect(result.lastNotifiedPrice).toBe(5);
  });

  it("does not re-alert a drop the anchor has already moved to", () => {
    const result = moveAlert(instrument({ currentPrice: 4.7, lastNotifiedPrice: 4.7 }), 4.7, 0.05);
    expect(result.event).toBeNull();
  });
});
