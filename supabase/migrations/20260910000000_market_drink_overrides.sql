-- Per-drink pricing overrides on a stock market event. Null means "use the
-- event setting" (floor/ceil/alert/low-stock) or the base price (opening).
-- Absolute prices, not multipliers, so staff can pin a drink to exact figures.

alter table public.stock_market_event_items
  add column if not exists opening_price   numeric(6,2),
  add column if not exists min_price       numeric(6,2),
  add column if not exists max_price       numeric(6,2),
  add column if not exists crash_price     numeric(6,2),
  add column if not exists low_stock_at    integer,
  add column if not exists alert_threshold numeric;

-- Snapshotted onto the live instrument when a session opens, like the price
-- and Square mapping already are.
alter table public.market_instruments
  add column if not exists min_price       numeric(6,2),
  add column if not exists max_price       numeric(6,2),
  add column if not exists crash_price     numeric(6,2),
  add column if not exists low_stock_at    integer,
  add column if not exists alert_threshold numeric;
