import { DEFAULT_MARKET_CONFIG, type MarketConfig } from "./types";

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
  isActive: boolean;
  menuItemIds: number[];
  lastRunAt: string | null;
  createdAt: string;
  createdBy: number | null;
  updatedAt: string;
  updatedBy: number | null;
};

export function eventConfig(row: StockMarketEventRow): MarketConfig {
  return {
    ...DEFAULT_MARKET_CONFIG,
    tickIntervalSec: Number(row.tick_interval_sec),
    noiseSigma: Number(row.noise_sigma),
    floorPct: Number(row.floor_pct),
    ceilPct: Number(row.ceil_pct),
    moveNotifyPct: Number(row.move_notify_pct),
    lowStockThreshold: Number(row.low_stock_threshold),
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
  menuItemIds: number[],
  lastRunAt: string | null
): StockMarketEventSummary {
  return {
    id: row.id,
    name: row.name,
    openTime: normaliseClock(row.open_time),
    closeTime: normaliseClock(row.close_time),
    config: eventConfig(row),
    isActive: row.is_active,
    menuItemIds,
    lastRunAt,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
