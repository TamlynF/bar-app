export type StockState = "ok" | "low" | "out";

export type MarketEventKind =
  | "price_drop"
  | "surge"
  | "crash"
  | "low_stock"
  | "out_of_stock"
  | "restock";

export type MarketConfig = {
  tickIntervalSec: number;
  noiseSigma: number;
  demandK: number;
  reversionK: number;
  decayK: number;
  floorPct: number;
  ceilPct: number;
  roundStep: number;
  moveNotifyPct: number;
  lowStockThreshold: number;
  crashFactor: number;
  crashDurationTicks: number;
};

/* roundStep keeps every quote chargeable at the till; moveNotifyPct is the
   cumulative move (vs the last alerted price) that wakes phones up. */
export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  tickIntervalSec: 60,
  noiseSigma: 0.015,
  demandK: 0.03,
  reversionK: 0.02,
  decayK: 0.6,
  floorPct: 0.7,
  ceilPct: 1.5,
  roundStep: 0.05,
  moveNotifyPct: 0.05,
  lowStockThreshold: 5,
  crashFactor: 0.75,
  crashDurationTicks: 5,
};

export function resolveMarketConfig(raw: unknown): MarketConfig {
  const source = (raw ?? {}) as Partial<Record<keyof MarketConfig, unknown>>;
  const config = { ...DEFAULT_MARKET_CONFIG };
  for (const key of Object.keys(config) as (keyof MarketConfig)[]) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) config[key] = value;
  }
  return config;
}

export type InstrumentState = {
  id: number;
  basePrice: number;
  currentPrice: number;
  lastNotifiedPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  squareVariationId: string | null;
  /* Absolute per-drink limits set on the event; null falls back to the
     session config multipliers against basePrice. */
  minPrice?: number | null;
  maxPrice?: number | null;
  crashPrice?: number | null;
  lowStockAt?: number | null;
  alertThreshold?: number | null;
  /* True while this drink alone is crashing; the board-wide crash lives on
     TickInputs. */
  crashActive?: boolean;
};

export type EngineEvent = {
  instrumentId: number;
  kind: MarketEventKind;
  payload: { from?: number; to?: number; pct?: number };
};

export type TickInputs = {
  config: MarketConfig;
  crashActive: boolean;
  newUnitsByInstrument: Map<number, number>;
  /* Inventory quantity per Square variation; a variation missing from the map
     is "unknown this tick" and keeps its previous stock state. */
  stockQtyByVariation: Map<string, number>;
  rng: () => number;
};

export type InstrumentTickResult = {
  id: number;
  price: number;
  demandUnits: number;
  stockState: StockState;
  lastNotifiedPrice: number;
  events: EngineEvent[];
};
