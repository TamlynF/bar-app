export type StockState = "ok" | "low" | "out";

export type MarketEventKind =
  | "price_drop"
  | "surge"
  | "crash"
  | "low_stock"
  | "out_of_stock"
  | "restock"
  | "tier_up"
  | "tier_down"
  | "rerank"
  | "warmup_done";

export type PricingMode = "demand" | "tiers";

/* Rank bands are cumulative upper bounds: bands [5, 10, 15] with down
   [0.3, 0.2, 0.1] means fewest-sold ranks 1–5 → −30%, 6–10 → −20%, 11–15 → −10%. */
export type TierPcts = {
  down: number[];
  up: number[];
  bands: number[];
};

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
  pushAlertsEnabled: boolean;
  pricingMode: PricingMode;
  rerankEveryTicks: number;
  glidePct: number;
  warmupUnits: number;
  tierPcts: TierPcts;
  paceFloorUnits: number;
  sessionTicksHint: number;
  leaderboardRows: number;
};

export type MarketConfigNumberKey = {
  [K in keyof MarketConfig]: MarketConfig[K] extends number ? K : never;
}[keyof MarketConfig];

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
  pushAlertsEnabled: true,
  pricingMode: "demand",
  rerankEveryTicks: 5,
  glidePct: 0.35,
  warmupUnits: 30,
  tierPcts: { down: [0.3, 0.2, 0.1], up: [0.3, 0.2, 0.1], bands: [5, 10, 15] },
  paceFloorUnits: 8,
  sessionTicksHint: 120,
  leaderboardRows: 0,
};

/* warmupUnits may legitimately be 0 (tiers from the first tick) and
   leaderboardRows 0 means "fill the screen"; every other numeric dial is
   meaningless at zero and falls back to its default. */
const ZERO_ALLOWED = new Set<keyof MarketConfig>(["warmupUnits", "leaderboardRows"]);

function numberList(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const list = value.map(Number);
  return list.every((n) => Number.isFinite(n)) ? list : null;
}

export function resolveTierPcts(raw: unknown): TierPcts {
  const source = (raw ?? {}) as Partial<Record<keyof TierPcts, unknown>>;
  const defaults = DEFAULT_MARKET_CONFIG.tierPcts;
  const bands = numberList(source.bands) ?? defaults.bands;
  const down = numberList(source.down) ?? defaults.down;
  const up = numberList(source.up) ?? defaults.up;
  const size = Math.min(bands.length, down.length, up.length);
  return { bands: bands.slice(0, size), down: down.slice(0, size), up: up.slice(0, size) };
}

export function resolveMarketConfig(raw: unknown): MarketConfig {
  const source = (raw ?? {}) as Partial<Record<keyof MarketConfig, unknown>>;
  const config = { ...DEFAULT_MARKET_CONFIG };
  for (const key of Object.keys(config) as (keyof MarketConfig)[]) {
    if (key === "pushAlertsEnabled") {
      if (typeof source[key] === "boolean") config[key] = source[key];
      continue;
    }
    if (key === "pricingMode") {
      if (source[key] === "demand" || source[key] === "tiers") config[key] = source[key];
      continue;
    }
    if (key === "tierPcts") {
      if (source[key] !== undefined) config[key] = resolveTierPcts(source[key]);
      continue;
    }
    const value = Number(source[key]);
    if (Number.isFinite(value) && (value > 0 || (value === 0 && ZERO_ALLOWED.has(key)))) {
      config[key] = value;
    }
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
  /* Tier engine only. normalUnitsPerNight is what this serve usually sells on
     a night like tonight; lastSaleTick / tierPct carry between ticks. */
  normalUnitsPerNight?: number | null;
  lastSaleTick?: number | null;
  tierPct?: number;
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

export type SeedMode = "temp" | "reuse";
