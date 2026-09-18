import type { MarketConfig, StockState } from "@/lib/market/types";

export type SessionSummary = {
  id: number;
  tickNo: number;
  startedAt: string;
  crashUntilTick: number | null;
  config: MarketConfig;
  stockMarketEventId: number | null;
  squareSyncEnabled: boolean;
};

/* A session (live or ended) whose linked drinks still carry market prices
   in Square. Null means the till already shows the normal menu. */
export type TillRestoreSummary = {
  sessionId: number;
  status: "live" | "ended";
  endedAt: string | null;
  count: number;
};

export type InstrumentSummary = {
  id: number;
  name: string;
  serve: string;
  basePrice: number;
  openingPrice: number;
  currentPrice: number;
  demandUnits: number;
  stockState: StockState;
  stockOverride: StockState | null;
  /* A crash on this drink alone is still running down its ticks. */
  crashing: boolean;
  mapped: boolean;
  /* Square's IN_STOCK count at the last tick; null when unlinked or unknown. */
  stockQty: number | null;
  /* Simulated units queued for the next tick (0 when nothing is waiting). */
  simPending: number;
  /* Tier leaderboard figures written by the engine each tick; all null or 0
     under demand pricing and before the market has warmed up. */
  normalUnitsPerNight: number | null;
  normalUnitsSource: string | null;
  pace: number | null;
  rankPos: number | null;
  tierPct: number | null;
  targetPrice: number | null;
  /* Session running totals kept by the tick; zero or null before the stats
     migration has run on the database. */
  unitsSold: number;
  highPrice: number | null;
  lowPrice: number | null;
  tierChanges: number;
  priceChanges: number;
  /* Resolved from the cached catalog map at render; null when the mapping is
     newer than the cache, which makes the link resolve on click instead. */
  squareItemId: string | null;
};

export type SquareSimOrder = {
  id: number;
  name: string;
  serve: string;
  units: number;
  amount: number | null;
  tender: "card" | "cash" | null;
  orderId: string | null;
  paymentId: string | null;
  at: string;
};

export type SquareSimSummary = {
  environment: "sandbox" | "production";
  locationId: string | null;
  sandboxSeededAt: string | null;
  recentOrders: SquareSimOrder[];
};

export type CategoryOption = {
  id: number;
  name: string;
  tradeableCount: number;
};

export type EmployeeOption = {
  id: number;
  full_name: string;
};

/* How many of the serves on any active event are linked to Square. */
export type SquareLinksSummary = {
  linked: number;
  onBoard: number;
};
