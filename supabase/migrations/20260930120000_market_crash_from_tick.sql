-- A crash can be queued for the next board update instead of starting on the
-- next tick. crash_from_tick is the first tick the crash is live; null means
-- it started straight away and only crash_until_tick bounds it.
alter table public.market_sessions
  add column if not exists crash_from_tick integer;

alter table public.market_instruments
  add column if not exists crash_from_tick integer;
