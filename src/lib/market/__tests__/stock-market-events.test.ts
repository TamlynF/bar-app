import { describe, expect, it } from "vitest";
import {
  eventConfig,
  formatTimeWindow,
  normaliseClock,
  summariseEvent,
  type StockMarketEventRow,
} from "../stock-market-events";
import { DEFAULT_MARKET_CONFIG, resolveMarketConfig } from "../types";

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

  it("reads the leaderboard row count, 0 meaning fill the screen", () => {
    expect(eventConfig(row).leaderboardRows).toBe(0);
    expect(eventConfig({ ...row, leaderboard_rows: 8 }).leaderboardRows).toBe(8);
    expect(resolveMarketConfig({ leaderboardRows: 0 }).leaderboardRows).toBe(0);
  });

  it("defaults phone alerts on for rows written before the column existed", () => {
    expect(eventConfig(row).pushAlertsEnabled).toBe(true);
    expect(eventConfig({ ...row, push_alerts_enabled: false }).pushAlertsEnabled).toBe(false);
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
    expect(summary.menuItemPriceIds).toEqual([3, 4]);
    expect(summary.lastRunAt).toBe("2026-09-03T20:00:00Z");
    expect(summary.config.tickIntervalSec).toBe(45);
  });
});

describe("eventConfig tier fields", () => {
  it("maps the tier columns and falls back to defaults when they are absent", () => {
    const tiers = eventConfig({
      ...row,
      pricing_mode: "tiers",
      rerank_every_ticks: "4",
      glide_pct: "0.5",
      warmup_units: 0,
      tier_pcts: { down: [0.3, 0.2, 0.1], up: [0.2, 0.15, 0.1], bands: [5, 10, 15] },
      pace_floor_units: "6",
      session_ticks_hint: "90",
    });
    expect(tiers.pricingMode).toBe("tiers");
    expect(tiers.rerankEveryTicks).toBe(4);
    expect(tiers.glidePct).toBe(0.5);
    expect(tiers.warmupUnits).toBe(0);
    expect(tiers.tierPcts.up).toEqual([0.2, 0.15, 0.1]);
    expect(tiers.paceFloorUnits).toBe(6);
    expect(tiers.sessionTicksHint).toBe(90);

    const legacy = eventConfig(row);
    expect(legacy.pricingMode).toBe("demand");
    expect(legacy.tierPcts).toEqual(DEFAULT_MARKET_CONFIG.tierPcts);
    expect(legacy.rerankEveryTicks).toBe(DEFAULT_MARKET_CONFIG.rerankEveryTicks);
  });
});
