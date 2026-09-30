import type { EngineEvent, InstrumentState, MarketConfig, StockState } from "./types";

export function roundToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type InstrumentLimits = {
  floor: number;
  ceil: number;
  crashTarget: number;
  lowStockAt: number;
  moveNotifyPct: number;
};

export type PricedInstrument = Pick<InstrumentState, "basePrice"> &
  Partial<Pick<InstrumentState, "minPrice" | "maxPrice" | "crashPrice" | "lowStockAt" | "alertThreshold">>;

export function instrumentLimits(
  instrument: PricedInstrument,
  config: MarketConfig
): InstrumentLimits {
  const { basePrice } = instrument;
  return {
    floor: instrument.minPrice ?? basePrice * config.floorPct,
    ceil: instrument.maxPrice ?? basePrice * config.ceilPct,
    crashTarget: instrument.crashPrice ?? basePrice * config.crashFactor,
    lowStockAt: instrument.lowStockAt ?? config.lowStockThreshold,
    moveNotifyPct: instrument.alertThreshold ?? config.moveNotifyPct,
  };
}

export function nextStockState(
  instrument: InstrumentState,
  config: MarketConfig,
  stockQtyByVariation: Map<string, number>
): StockState {
  if (instrument.stockOverride) return instrument.stockOverride;
  if (instrument.stockTracked === false) return "ok";
  const qty = instrument.squareVariationId
    ? stockQtyByVariation.get(instrument.squareVariationId)
    : undefined;
  if (qty === undefined) return instrument.stockState;
  if (qty <= 0) return "out";
  if (qty <= instrumentLimits(instrument, config).lowStockAt) return "low";
  return "ok";
}

export function stockEvent(previous: StockState, next: StockState): EngineEvent["kind"] | null {
  if (previous === next) return null;
  if (next === "out") return "out_of_stock";
  if (next === "low") return previous === "out" ? "restock" : "low_stock";
  return previous === "out" ? "restock" : null;
}

/* Surge / price-drop detection: fires when the price
   has moved moveNotifyPct or more away from the last alerted price AND moved
   in that direction this tick, then re-arms at the new price. */
export function moveAlert(
  instrument: InstrumentState,
  price: number,
  moveNotifyPct: number
): { event: EngineEvent | null; lastNotifiedPrice: number } {
  const lastNotifiedPrice = instrument.lastNotifiedPrice;
  const move = (price - lastNotifiedPrice) / lastNotifiedPrice;
  const payload = { from: lastNotifiedPrice, to: price, pct: Math.round(move * 1000) / 10 };
  if (move <= -moveNotifyPct && price < instrument.currentPrice) {
    return { event: { instrumentId: instrument.id, kind: "price_drop", payload }, lastNotifiedPrice: price };
  }
  if (move >= moveNotifyPct && price > instrument.currentPrice) {
    return { event: { instrumentId: instrument.id, kind: "surge", payload }, lastNotifiedPrice: price };
  }
  return { event: null, lastNotifiedPrice };
}
