import type {
  EngineEvent,
  InstrumentState,
  InstrumentTickResult,
  MarketConfig,
  StockState,
  TickInputs,
} from "./types";

function roundToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function nextPrice(
  instrument: InstrumentState,
  newUnits: number,
  config: MarketConfig,
  crashActive: boolean,
  rng: () => number
): number {
  const { basePrice, currentPrice } = instrument;

  const demandBoost = config.demandK * Math.log1p(newUnits);
  const reversion = config.reversionK * ((currentPrice - basePrice) / basePrice);
  const noise = config.noiseSigma * (2 * rng() - 1);

  let drift = demandBoost - reversion + noise;

  /* A crash drags every price halfway to the crash floor each tick, so the
     board visibly tumbles for crashDurationTicks then recovers naturally. */
  if (crashActive) {
    const crashTarget = basePrice * config.crashFactor;
    drift += 0.5 * ((crashTarget - currentPrice) / currentPrice);
  }

  const raw = currentPrice * (1 + drift);
  const clamped = clamp(raw, basePrice * config.floorPct, basePrice * config.ceilPct);
  return roundToStep(clamped, config.roundStep);
}

function nextStockState(
  instrument: InstrumentState,
  config: MarketConfig,
  stockQtyByVariation: Map<string, number>
): StockState {
  if (instrument.stockOverride) return instrument.stockOverride;
  const qty = instrument.squareVariationId
    ? stockQtyByVariation.get(instrument.squareVariationId)
    : undefined;
  if (qty === undefined) return instrument.stockState;
  if (qty <= 0) return "out";
  if (qty <= config.lowStockThreshold) return "low";
  return "ok";
}

function stockEvent(previous: StockState, next: StockState): EngineEvent["kind"] | null {
  if (previous === next) return null;
  if (next === "out") return "out_of_stock";
  if (next === "low") return previous === "out" ? "restock" : "low_stock";
  return previous === "out" ? "restock" : null;
}

export function tickInstrument(
  instrument: InstrumentState,
  inputs: TickInputs
): InstrumentTickResult {
  const { config } = inputs;
  const newUnits = inputs.newUnitsByInstrument.get(instrument.id) ?? 0;
  const events: EngineEvent[] = [];

  const stockState = nextStockState(instrument, config, inputs.stockQtyByVariation);
  const stockKind = stockEvent(instrument.stockState, stockState);
  if (stockKind) events.push({ instrumentId: instrument.id, kind: stockKind, payload: {} });

  const demandUnits =
    Math.round((instrument.demandUnits * config.decayK + newUnits) * 1000) / 1000;

  /* Sold out freezes the quote - nobody trades what nobody can buy. */
  const price =
    stockState === "out"
      ? instrument.currentPrice
      : nextPrice(instrument, newUnits, config, inputs.crashActive, inputs.rng);

  let lastNotifiedPrice = instrument.lastNotifiedPrice;
  const move = (price - lastNotifiedPrice) / lastNotifiedPrice;
  if (move <= -config.moveNotifyPct && price < instrument.currentPrice) {
    events.push({
      instrumentId: instrument.id,
      kind: "price_drop",
      payload: { from: lastNotifiedPrice, to: price, pct: Math.round(move * 1000) / 10 },
    });
    lastNotifiedPrice = price;
  } else if (move >= config.moveNotifyPct && price > instrument.currentPrice) {
    events.push({
      instrumentId: instrument.id,
      kind: "surge",
      payload: { from: lastNotifiedPrice, to: price, pct: Math.round(move * 1000) / 10 },
    });
    lastNotifiedPrice = price;
  }

  return { id: instrument.id, price, demandUnits, stockState, lastNotifiedPrice, events };
}

export function runTick(
  instruments: InstrumentState[],
  inputs: TickInputs
): InstrumentTickResult[] {
  return instruments.map((instrument) => tickInstrument(instrument, inputs));
}
