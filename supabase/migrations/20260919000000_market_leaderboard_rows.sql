-- How many drinks the big-screen leaderboard lists per column.
-- 0 (the default) = as many as fit the screen the board is on.

alter table public.stock_market_events
  add column if not exists leaderboard_rows integer not null default 0;
