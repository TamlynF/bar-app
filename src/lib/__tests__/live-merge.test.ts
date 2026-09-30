import { describe, expect, it } from "vitest";
import { mergeLiveInstruments } from "../market/live-merge";
import type { MarketInstrumentPayload, MarketStatePayload } from "../market/tick";

const row = {
  id: 7,
  name: "Guinness",
  currentPrice: 4.95,
  stockState: "ok" as const,
  demandUnits: 1,
  pace: null,
  rankPos: null,
  tierPct: null,
  targetPrice: null,
  normalUnitsPerNight: null,
  stockQty: 20,
  simPending: 5,
};

function payload(overrides: Partial<MarketInstrumentPayload>, tickNo = 10): MarketStatePayload {
  return {
    status: "live",
    sessionId: 3,
    tickNo,
    instruments: [
      {
        id: 7,
        name: "Guinness",
        serve: "pint",
        price: 5.4,
        basePrice: 4.95,
        openingPrice: 4.95,
        changePct: 9.1,
        direction: "up",
        stock: "low",
        spark: [],
        category: null,
        categoryOrder: 0,
        demandUnits: 3.5,
        floor: 3,
        ceil: 7,
        tillPrice: null,
        tillSyncError: null,
        linkedToTill: true,
        tierPct: 0.1,
        targetPrice: 5.45,
        pace: 1.4,
        rankPos: 2,
        normalUnitsPerNight: 12,
        stockQty: 4,
        mixerPrice: null,
        ...overrides,
      },
    ],
  };
}

describe("mergeLiveInstruments", () => {
  it("takes the mixer back off so staff rows hold the spirit price", () => {
    const [merged] = mergeLiveInstruments([row], payload({ price: 6.25, targetPrice: 6.7, mixerPrice: 1.25 }), 3, 10);
    expect(merged.currentPrice).toBe(5);
    expect(merged.targetPrice).toBe(5.45);
  });

  it("follows the mixer price on rows that show it", () => {
    const [merged] = mergeLiveInstruments([{ ...row, mixerPrice: null }], payload({ price: 6.25, mixerPrice: 1.25 }), 3, 10);
    expect(merged.mixerPrice).toBe(1.25);
    expect(merged.currentPrice).toBe(5);
  });

  it("overlays the moving fields and keeps the rest", () => {
    const [merged] = mergeLiveInstruments([row], payload({}), 3, 10);
    expect(merged.currentPrice).toBe(5.4);
    expect(merged.stockState).toBe("low");
    expect(merged.stockQty).toBe(4);
    expect(merged.rankPos).toBe(2);
    expect(merged.name).toBe("Guinness");
    expect(merged.simPending).toBe(5);
  });

  it("clears queued simulated sales once the tick has moved on", () => {
    const [merged] = mergeLiveInstruments([row], payload({}, 11), 3, 10);
    expect(merged.simPending).toBe(0);
  });

  it("ignores a closed market or another session", () => {
    expect(mergeLiveInstruments([row], { status: "closed" }, 3, 10)[0]).toBe(row);
    expect(mergeLiveInstruments([row], payload({}), 4, 10)[0]).toBe(row);
    expect(mergeLiveInstruments([row], null, 3, 10)[0]).toBe(row);
  });

  it("leaves rows the payload does not carry untouched", () => {
    const other = { ...row, id: 8 };
    const [, merged] = mergeLiveInstruments([row, other], payload({}), 3, 10);
    expect(merged).toBe(other);
  });
});
