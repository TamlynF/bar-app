/* Whether the nightly Square sales sync can be trusted before a market
   opens. Opening works out each drink's normal units per night from the
   synced order lines, so a failed or missed sync quietly leaves the tiers
   ranking against older nights. */

export type SalesSyncState = {
  last_synced_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

export type SalesSyncHealth =
  | { healthy: true; lastSyncedAt: string }
  | {
      healthy: false;
      reason: "failed" | "stale" | "never";
      lastSyncedAt: string | null;
      lastRunAt: string | null;
      lastError: string | null;
    };

/* The cron runs once a night, so a good sync is never much more than a day
   old; past this it has missed at least one run. */
export const SALES_SYNC_STALE_HOURS = 30;

export function salesSyncHealth(state: SalesSyncState | null, now: Date = new Date()): SalesSyncHealth {
  const lastSyncedAt = state?.last_synced_at ?? null;
  const unhealthy = (reason: "failed" | "stale" | "never"): SalesSyncHealth => ({
    healthy: false,
    reason,
    lastSyncedAt,
    lastRunAt: state?.last_run_at ?? null,
    lastError: state?.last_error ?? null,
  });
  if (!lastSyncedAt) return unhealthy("never");
  if (state?.last_status === "error") return unhealthy("failed");
  const ageHours = (now.getTime() - new Date(lastSyncedAt).getTime()) / 3_600_000;
  if (ageHours > SALES_SYNC_STALE_HOURS) return unhealthy("stale");
  return { healthy: true, lastSyncedAt };
}
