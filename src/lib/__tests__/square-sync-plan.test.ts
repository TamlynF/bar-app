import { describe, expect, it } from "vitest";
import {
  historyStart,
  monthsBefore,
  planSync,
  retentionCutoff,
  shouldAlertOnFailure,
  splitWindows,
} from "../square-sync-plan";

const now = new Date("2026-10-10T03:00:00.000Z");

describe("monthsBefore", () => {
  it("steps back whole months", () => {
    expect(monthsBefore(now, 6).toISOString()).toBe("2026-04-10T03:00:00.000Z");
    expect(historyStart(now).toISOString()).toBe("2026-04-10T03:00:00.000Z");
    expect(retentionCutoff(now)).toBe("2026-03-10");
  });
});

describe("splitWindows", () => {
  it("cuts the range into fixed windows with a short tail", () => {
    const windows = splitWindows(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-17T12:00:00Z"), 7);
    expect(windows.map((w) => [w.from.toISOString(), w.to.toISOString()])).toEqual([
      ["2026-10-01T00:00:00.000Z", "2026-10-08T00:00:00.000Z"],
      ["2026-10-08T00:00:00.000Z", "2026-10-15T00:00:00.000Z"],
      ["2026-10-15T00:00:00.000Z", "2026-10-17T12:00:00.000Z"],
    ]);
  });

  it("is empty when there is nothing to cover", () => {
    expect(splitWindows(now, now)).toEqual([]);
  });
});

describe("planSync", () => {
  it("starts a six-month backfill the first time", () => {
    const plan = planSync(null, now);
    expect(plan.phase).toBe("backfill");
    expect(plan.from.toISOString()).toBe("2026-04-10T03:00:00.000Z");
    expect(plan.windows.length).toBe(27);
    expect(plan.windows[0].from).toEqual(plan.from);
    expect(plan.windows.at(-1)?.to).toEqual(now);
  });

  it("backfills from six months ago even when older syncs only kept 90 days", () => {
    const plan = planSync({ last_synced_at: "2026-10-09T03:00:00Z" }, now);
    expect(plan.phase).toBe("backfill");
    expect(plan.from.toISOString()).toBe("2026-04-10T03:00:00.000Z");
  });

  it("carries on from the backfill cursor", () => {
    const plan = planSync({ last_synced_at: null, backfill_cursor: "2026-09-26T03:00:00Z" }, now);
    expect(plan.phase).toBe("backfill");
    expect(plan.windows.map((w) => w.from.toISOString())).toEqual(["2026-09-26T03:00:00.000Z", "2026-10-03T03:00:00.000Z"]);
  });

  it("tops up from the watermark with a lookback once the backfill is done", () => {
    const plan = planSync(
      { last_synced_at: "2026-10-09T03:00:00Z", backfill_done_at: "2026-09-01T00:00:00Z" },
      now
    );
    expect(plan.phase).toBe("incremental");
    expect(plan.from.toISOString()).toBe("2026-10-06T03:00:00.000Z");
    expect(plan.windows.length).toBe(1);
  });

  it("windows a long gap after missed runs", () => {
    const plan = planSync(
      { last_synced_at: "2026-09-01T03:00:00Z", backfill_done_at: "2026-08-01T00:00:00Z" },
      now
    );
    expect(plan.phase).toBe("incremental");
    expect(plan.windows.length).toBe(6);
  });
});

describe("shouldAlertOnFailure", () => {
  it("alerts on the first failure and every third after", () => {
    expect([1, 2, 3, 4, 5, 6].map(shouldAlertOnFailure)).toEqual([true, false, true, false, false, true]);
  });
});
