import { describe, expect, it } from "vitest";
import { salesSyncHealth } from "../sales-sync-health";

const now = new Date("2026-10-02T19:00:00Z");

describe("salesSyncHealth", () => {
  it("is healthy after last night's sync", () => {
    const health = salesSyncHealth(
      { last_synced_at: "2026-10-02T03:00:00Z", last_run_at: "2026-10-02T03:00:00Z", last_status: "ok", last_error: null },
      now
    );
    expect(health).toEqual({ healthy: true, lastSyncedAt: "2026-10-02T03:00:00Z" });
  });

  it("flags a run that failed, with Square's error", () => {
    const health = salesSyncHealth(
      { last_synced_at: "2026-10-01T03:00:00Z", last_run_at: "2026-10-02T03:00:00Z", last_status: "error", last_error: "401" },
      now
    );
    expect(health).toMatchObject({ healthy: false, reason: "failed", lastError: "401", lastRunAt: "2026-10-02T03:00:00Z" });
  });

  it("flags a sync that has missed a night", () => {
    const health = salesSyncHealth(
      { last_synced_at: "2026-09-30T03:00:00Z", last_run_at: "2026-09-30T03:00:00Z", last_status: "ok", last_error: null },
      now
    );
    expect(health).toMatchObject({ healthy: false, reason: "stale" });
  });

  it("flags a venue that has never synced", () => {
    expect(salesSyncHealth(null, now)).toMatchObject({ healthy: false, reason: "never" });
  });
});
