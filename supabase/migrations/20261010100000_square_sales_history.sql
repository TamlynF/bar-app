-- Square sales history: six-month backfill in batches, incremental top-ups,
-- seven-month retention and a run log for the scheduled sync.
--
-- square_sync_state gains the backfill bookkeeping (where the first full
-- pull has got to, when it finished) plus failure tracking for alerts.
-- square_sync_runs is the error log: one row per run, cron or manual, with
-- what it covered, how many attempts the Square calls needed and any error.
-- Rows older than the retention window are pruned by the sync from the app's
-- own tables only; nothing in Square is ever changed.

alter table public.square_sync_state
  add column if not exists backfill_from         timestamptz,
  add column if not exists backfill_cursor       timestamptz,
  add column if not exists backfill_done_at      timestamptz,
  add column if not exists consecutive_failures  integer not null default 0,
  add column if not exists last_alerted_at       timestamptz,
  add column if not exists last_pruned_at        timestamptz,
  add column if not exists last_pruned_orders    integer not null default 0;

create table if not exists public.square_sync_runs (
  id              bigint generated always as identity primary key,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  trigger         text not null default 'cron',     -- 'cron' | 'manual'
  phase           text not null,                    -- 'backfill' | 'incremental'
  status          text not null default 'running',  -- 'running' | 'ok' | 'partial' | 'error'
  from_at         timestamptz,
  to_at           timestamptz,
  windows_total   integer not null default 0,
  windows_done    integer not null default 0,
  orders_synced   integer not null default 0,
  lines_synced    integer not null default 0,
  orders_pruned   integer not null default 0,
  attempts        integer not null default 0,
  error           text
);

create index if not exists square_sync_runs_started_at_idx
  on public.square_sync_runs (started_at desc);

grant all on public.square_sync_runs to anon, authenticated, service_role;

alter table public.square_sync_runs enable row level security;
drop policy if exists "Allow authenticated read" on public.square_sync_runs;
create policy "Allow authenticated read" on public.square_sync_runs
  for select to authenticated using (true);
