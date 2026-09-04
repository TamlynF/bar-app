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

export type InstrumentLimits = {
  floor: number;
  ceil: number;
  crashTarget: number;
  lowStockAt: number;
  moveNotifyPct: number;
};

export function instrumentLimits(
  instrument: InstrumentState,
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

function nextPrice(
  instrument: InstrumentState,
  newUnits: number,
  config: MarketConfig,
  crashActive: boolean,
  rng: () => number
): number {
  const { basePrice, currentPrice } = instrument;
  const limits = instrumentLimits(instrument, config);

  const demandBoost = config.demandK * Math.log1p(newUnits);
  const reversion = config.reversionK * ((currentPrice - basePrice) / basePrice);
  const noise = config.noiseSigma * (2 * rng() - 1);

  let drift = demandBoost - reversion + noise;

  /* A crash drags every price halfway to the crash floor each tick, so the
     board visibly tumbles for crashDurationTicks then recovers naturally. */
  if (crashActive) {
    drift += 0.5 * ((limits.crashTarget - currentPrice) / currentPrice);
  }

  const raw = currentPrice * (1 + drift);
  const clamped = clamp(raw, limits.floor, limits.ceil);
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
  if (qty <= instrumentLimits(instrument, config).lowStockAt) return "low";
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

  /* Sold out freezes the quote - nobody trades what nobody can buy. The
     override is checked directly too, so a manual "sold out" freezes the very
     tick it is set rather than one tick later. */
  const frozen = stockState === "out" || instrument.stockOverride === "out";
  const crashing = inputs.crashActive || instrument.crashActive === true;
  const price = frozen
    ? instrument.currentPrice
    : nextPrice(instrument, newUnits, config, crashing, inputs.rng);

  const { moveNotifyPct } = instrumentLimits(instrument, config);
  let lastNotifiedPrice = instrument.lastNotifiedPrice;
  const move = (price - lastNotifiedPrice) / lastNotifiedPrice;
  if (move <= -moveNotifyPct && price < instrument.currentPrice) {
    events.push({
      instrumentId: instrument.id,
      kind: "price_drop",
      payload: { from: lastNotifiedPrice, to: price, pct: Math.round(move * 1000) / 10 },
    });
    lastNotifiedPrice = price;
  } else if (move >= moveNotifyPct && price > instrument.currentPrice) {
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
