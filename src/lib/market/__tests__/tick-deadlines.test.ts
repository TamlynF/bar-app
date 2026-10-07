import { describe, expect, it } from "vitest";
import { crashEndsAt, nextRerankAt, nextTickDueAt, nextUpdateTick } from "../tick";
import { resolveMarketConfig } from "../types";

const config = resolveMarketConfig({ tickIntervalSec: 60, rerankEveryTicks: 10 });
const lastTick = "2026-10-07T20:00:00.000Z";
const now = new Date("2026-10-07T20:00:20.000Z");

describe("nextTickDueAt", () => {
  it("is one interval after the last tick, whenever it is asked", () => {
    expect(nextTickDueAt({ last_tick_at: lastTick }, config, now).toISOString()).toBe("2026-10-07T20:01:00.000Z");
    const later = new Date("2026-10-07T20:00:50.000Z");
    expect(nextTickDueAt({ last_tick_at: lastTick }, config, later).toISOString()).toBe("2026-10-07T20:01:00.000Z");
  });

  it("falls back to one interval from now before the first tick", () => {
    expect(nextTickDueAt({ last_tick_at: null }, config, now).toISOString()).toBe("2026-10-07T20:01:20.000Z");
  });
});

describe("nextRerankAt", () => {
  it("lands on the tick the next re-rank falls on", () => {
    const session = { tick_no: 13, warmed_up_tick: 4, last_tick_at: lastTick };
    expect(nextUpdateTick(session, config)).toBe(20);
    expect(nextRerankAt(session, config, now)?.toISOString()).toBe("2026-10-07T20:07:00.000Z");
  });

  it("is the next tick when every tick re-ranks", () => {
    const everyTick = resolveMarketConfig({ tickIntervalSec: 300, rerankEveryTicks: 1 });
    const session = { tick_no: 7, warmed_up_tick: 2, last_tick_at: lastTick };
    expect(nextRerankAt(session, everyTick, now)?.toISOString()).toBe("2026-10-07T20:05:00.000Z");
  });

  it("is null before warm-up", () => {
    expect(nextRerankAt({ tick_no: 3, warmed_up_tick: null, last_tick_at: lastTick }, config, now)).toBeNull();
  });
});

describe("crashEndsAt", () => {
  it("ends on the tick after crash_until_tick", () => {
    const session = { tick_no: 10, crash_until_tick: 14, last_tick_at: lastTick };
    expect(crashEndsAt(session, config, now).toISOString()).toBe("2026-10-07T20:05:00.000Z");
  });

  it("counts from now when the last tick is overdue", () => {
    const stale = new Date("2026-10-07T20:02:30.000Z");
    const session = { tick_no: 10, crash_until_tick: 12, last_tick_at: lastTick };
    expect(crashEndsAt(session, config, stale).toISOString()).toBe("2026-10-07T20:04:30.000Z");
  });
});
