-- Simulated sales can be rung through the Square SANDBOX as real orders and
-- payments, so the market picks them up via the normal orders.search poll.
-- Those rows are recorded for the demo log, not queued for the tick.

alter table public.market_sim_sales
  add column if not exists square_order_id   text,
  add column if not exists square_payment_id text,
  add column if not exists amount            numeric,
  add column if not exists tender            text;

-- Set when the live session's instruments were seeded into the sandbox catalog
-- (their square_variation_id then points at sandbox objects for this session only).
alter table public.market_sessions
  add column if not exists sandbox_seeded_at timestamptz;
