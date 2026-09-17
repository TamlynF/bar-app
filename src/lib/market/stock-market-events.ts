import { DEFAULT_MARKET_CONFIG, resolveTierPcts, type MarketConfig, type PricingMode } from "./types";

export type StockMarketEventRow = {
  id: number;
  name: string;
  open_time: string;
  close_time: string;
  tick_interval_sec: number | string;
  noise_sigma: number | string;
  floor_pct: number | string;
  ceil_pct: number | string;
  move_notify_pct: number | string;
  low_stock_threshold: number | string;
  push_alerts_enabled?: boolean | null;
  pricing_mode?: string | null;
  rerank_every_ticks?: number | string | null;
  glide_pct?: number | string | null;
  warmup_units?: number | string | null;
  tier_pcts?: unknown;
  pace_floor_units?: number | string | null;
  session_ticks_hint?: number | string | null;
  leaderboard_rows?: number | string | null;
  weekdays?: number[] | null;
  bank_holiday_profile?: number | null;
  history_from?: string | null;
  history_to?: string | null;
  exclude_market_nights?: boolean | null;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
};

export type StockMarketEventSummary = {
  id: number;
  name: string;
  openTime: string;
  closeTime: string;
  config: MarketConfig;
  weekdays: number[];
  bankHolidayProfile: number | null;
  historyFrom: string | null;
  historyTo: string | null;
  excludeMarketNights: boolean;
  isActive: boolean;
  menuItemPriceIds: number[];
  lastRunAt: string | null;
  createdAt: string;
  createdBy: number | null;
  updatedAt: string;
  updatedBy: number | null;
};

function numberOr(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pricingModeOf(value: string | null | undefined): PricingMode {
  return value === "tiers" ? "tiers" : "demand";
}

export function eventConfig(row: StockMarketEventRow): MarketConfig {
  const d = DEFAULT_MARKET_CONFIG;
  return {
    ...d,
    tickIntervalSec: Number(row.tick_interval_sec),
    noiseSigma: Number(row.noise_sigma),
    floorPct: Number(row.floor_pct),
    ceilPct: Number(row.ceil_pct),
    moveNotifyPct: Number(row.move_notify_pct),
    lowStockThreshold: Number(row.low_stock_threshold),
    pushAlertsEnabled: row.push_alerts_enabled ?? true,
    pricingMode: pricingModeOf(row.pricing_mode),
    rerankEveryTicks: numberOr(row.rerank_every_ticks, d.rerankEveryTicks),
    glidePct: numberOr(row.glide_pct, d.glidePct),
    warmupUnits: numberOr(row.warmup_units, d.warmupUnits),
    tierPcts: row.tier_pcts === undefined || row.tier_pcts === null ? d.tierPcts : resolveTierPcts(row.tier_pcts),
    paceFloorUnits: numberOr(row.pace_floor_units, d.paceFloorUnits),
    sessionTicksHint: numberOr(row.session_ticks_hint, d.sessionTicksHint),
    leaderboardRows: numberOr(row.leaderboard_rows, d.leaderboardRows),
  };
}

export function normaliseClock(value: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? "").trim());
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

export function formatTimeWindow(open: string, close: string): string {
  const from = normaliseClock(open);
  const to = normaliseClock(close);
  if (!from && !to) return "";
  return `${from || "?"} to ${to || "?"}`;
}

export function summariseEvent(
  row: StockMarketEventRow,
  menuItemPriceIds: number[],
  lastRunAt: string | null
): StockMarketEventSummary {
  return {
    id: row.id,
    name: row.name,
    openTime: normaliseClock(row.open_time),
    closeTime: normaliseClock(row.close_time),
    config: eventConfig(row),
    weekdays: (row.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    bankHolidayProfile: row.bank_holiday_profile ?? null,
    historyFrom: row.history_from ?? null,
    historyTo: row.history_to ?? null,
    excludeMarketNights: row.exclude_market_nights ?? true,
    isActive: row.is_active,
    menuItemPriceIds,
    lastRunAt,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
