import type { MarketConfig } from "./types";

export type DrinkOverrides = {
  openingPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  crashPrice: number | null;
  lowStockAt: number | null;
  alertThreshold: number | null;
};

export type DrinkOverrideRow = {
  opening_price?: number | string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  crash_price?: number | string | null;
  low_stock_at?: number | string | null;
  alert_threshold?: number | string | null;
};

export type EffectiveDrinkSettings = {
  [K in keyof DrinkOverrides]: number;
};

export const EMPTY_OVERRIDES: DrinkOverrides = {
  openingPrice: null,
  minPrice: null,
  maxPrice: null,
  crashPrice: null,
  lowStockAt: null,
  alertThreshold: null,
};

export function optionalNumber(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function overridesFromRow(
  row: DrinkOverrideRow | null | undefined
): DrinkOverrides {
  return {
    openingPrice: optionalNumber(row?.opening_price),
    minPrice: optionalNumber(row?.min_price),
    maxPrice: optionalNumber(row?.max_price),
    crashPrice: optionalNumber(row?.crash_price),
    lowStockAt: optionalNumber(row?.low_stock_at),
    alertThreshold: optionalNumber(row?.alert_threshold),
  };
}

export function overridesToRow(overrides: DrinkOverrides) {
  return {
    opening_price: overrides.openingPrice,
    min_price: overrides.minPrice,
    max_price: overrides.maxPrice,
    crash_price: overrides.crashPrice,
    low_stock_at: overrides.lowStockAt,
    alert_threshold: overrides.alertThreshold,
  };
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function defaultDrinkSettings(
  basePrice: number,
  config: MarketConfig
): EffectiveDrinkSettings {
  return {
    openingPrice: money(basePrice),
    minPrice: money(basePrice * config.floorPct),
    maxPrice: money(basePrice * config.ceilPct),
    crashPrice: money(basePrice * config.crashFactor),
    lowStockAt: config.lowStockThreshold,
    alertThreshold: config.moveNotifyPct,
  };
}

export function effectiveDrinkSettings(
  basePrice: number,
  config: MarketConfig,
  overrides: DrinkOverrides
): EffectiveDrinkSettings {
  const defaults = defaultDrinkSettings(basePrice, config);
  return {
    openingPrice: overrides.openingPrice ?? defaults.openingPrice,
    minPrice: overrides.minPrice ?? defaults.minPrice,
    maxPrice: overrides.maxPrice ?? defaults.maxPrice,
    crashPrice: overrides.crashPrice ?? defaults.crashPrice,
    lowStockAt: overrides.lowStockAt ?? defaults.lowStockAt,
    alertThreshold: overrides.alertThreshold ?? defaults.alertThreshold,
  };
}
