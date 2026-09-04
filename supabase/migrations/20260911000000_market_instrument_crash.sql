-- A single drink can be crashed on its own; the tick it recovers on is stored
-- per instrument, mirroring market_sessions.crash_until_tick for the whole board.

alter table public.market_instruments
  add column if not exists crash_until_tick integer;
