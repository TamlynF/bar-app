import { describe, expect, it } from "vitest";
import {
  eventConfig,
  formatTimeWindow,
  normaliseClock,
  summariseEvent,
  type StockMarketEventRow,
} from "../stock-market-events";
import { DEFAULT_MARKET_CONFIG } from "../types";

const row: StockMarketEventRow = {
  id: 7,
  name: "Friday floor",
  open_time: "19:00:00",
  close_time: "23:30:00",
  tick_interval_sec: "45",
  noise_sigma: "0.02",
  floor_pct: "0.6",
  ceil_pct: "1.8",
  move_notify_pct: "0.1",
  low_stock_threshold: "3",
  is_active: true,
  created_at: "2026-09-01T10:00:00Z",
  created_by: 1,
  updated_at: "2026-09-02T10:00:00Z",
  updated_by: 2,
};

describe("eventConfig", () => {
  it("maps the six stored columns onto the engine config and keeps the rest at defaults", () => {
    const config = eventConfig(row);
    expect(config.tickIntervalSec).toBe(45);
    expect(config.noiseSigma).toBe(0.02);
    expect(config.floorPct).toBe(0.6);
    expect(config.ceilPct).toBe(1.8);
    expect(config.moveNotifyPct).toBe(0.1);
    expect(config.lowStockThreshold).toBe(3);
    expect(config.crashFactor).toBe(DEFAULT_MARKET_CONFIG.crashFactor);
    expect(config.decayK).toBe(DEFAULT_MARKET_CONFIG.decayK);
  });
});

describe("normaliseClock", () => {
  it("trims seconds and zero-pads hours", () => {
    expect(normaliseClock("19:00:00")).toBe("19:00");
    expect(normaliseClock("9:05")).toBe("09:05");
  });

  it("rejects nonsense", () => {
    expect(normaliseClock("")).toBe("");
    expect(normaliseClock(null)).toBe("");
    expect(normaliseClock("25:00")).toBe("");
    expect(normaliseClock("later")).toBe("");
  });
});

describe("formatTimeWindow", () => {
  it("renders open to close", () => {
    expect(formatTimeWindow("19:00:00", "23:30:00")).toBe("19:00 to 23:30");
  });

  it("tolerates a missing side", () => {
    expect(formatTimeWindow("19:00", "")).toBe("19:00 to ?");
    expect(formatTimeWindow("", "")).toBe("");
  });
});

describe("summariseEvent", () => {
  it("flattens a row with its drinks and last run", () => {
    const summary = summariseEvent(row, [3, 4], "2026-09-03T20:00:00Z");
    expect(summary.openTime).toBe("19:00");
    expect(summary.closeTime).toBe("23:30");
    expect(summary.menuItemIds).toEqual([3, 4]);
    expect(summary.lastRunAt).toBe("2026-09-03T20:00:00Z");
    expect(summary.config.tickIntervalSec).toBe(45);
  });
});
