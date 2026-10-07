/* The pure side of the scheduled Square sales sync: which stretch of time
   a run covers, cut into windows small enough that a Vercel function never
   times out mid-pull, and how long the app keeps what it pulled. */

export const HISTORY_MONTHS = 6;
export const RETENTION_MONTHS = 7;
export const WINDOW_DAYS = 7;
/* Orders can close a little after their payment lands, so every incremental
   run re-reads the last few days and the upsert makes that harmless. */
export const INCREMENTAL_LOOKBACK_DAYS = 3;
export const SYNC_ATTEMPTS = 3;
export const SYNC_RETRY_DELAYS_MS = [2000, 8000];
/* Mail the venue on the first failure of a streak, then every third one, so
   a Square outage reads as one alert rather than a nightly drip. */
export const ALERT_EVERY_FAILURES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncStateLike = {
  last_synced_at: string | null;
  backfill_cursor?: string | null;
  backfill_done_at?: string | null;
};

export type SyncWindow = { from: Date; to: Date };

export type SyncPlan = {
  phase: "backfill" | "incremental";
  from: Date;
  to: Date;
  windows: SyncWindow[];
};

export function monthsBefore(now: Date, months: number): Date {
  const out = new Date(now.getTime());
  out.setUTCMonth(out.getUTCMonth() - months);
  return out;
}

export function historyStart(now: Date): Date {
  return monthsBefore(now, HISTORY_MONTHS);
}

/* Orders whose business date is before this are dropped from the app. */
export function retentionCutoff(now: Date): string {
  return monthsBefore(now, RETENTION_MONTHS).toISOString().slice(0, 10);
}

export function splitWindows(from: Date, to: Date, windowDays: number = WINDOW_DAYS): SyncWindow[] {
  const windows: SyncWindow[] = [];
  const step = Math.max(1, windowDays) * DAY_MS;
  let cursor = from.getTime();
  const end = to.getTime();
  while (cursor < end) {
    const next = Math.min(cursor + step, end);
    windows.push({ from: new Date(cursor), to: new Date(next) });
    cursor = next;
  }
  return windows;
}

/* Until the first six-month pull has finished, every run carries on from
   where the backfill cursor stopped; after that, each run tops up from the
   watermark. A long gap (missed runs) is windowed the same way, so a sync
   that has been down for a month catches up in batches too. */
export function planSync(state: SyncStateLike | null, now: Date, windowDays: number = WINDOW_DAYS): SyncPlan {
  if (!state?.backfill_done_at) {
    const from = state?.backfill_cursor ? new Date(state.backfill_cursor) : historyStart(now);
    const start = new Date(Math.min(from.getTime(), now.getTime()));
    return { phase: "backfill", from: start, to: now, windows: splitWindows(start, now, windowDays) };
  }
  const watermark = state.last_synced_at ? new Date(state.last_synced_at) : historyStart(now);
  const from = new Date(Math.min(watermark.getTime() - INCREMENTAL_LOOKBACK_DAYS * DAY_MS, now.getTime()));
  return { phase: "incremental", from, to: now, windows: splitWindows(from, now, windowDays) };
}

export function shouldAlertOnFailure(consecutiveFailures: number): boolean {
  return consecutiveFailures === 1 || consecutiveFailures % ALERT_EVERY_FAILURES === 0;
}
