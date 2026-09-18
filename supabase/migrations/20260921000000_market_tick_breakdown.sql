-- Per-tick working for the trading floor's "Tick breakdown" sheet: the
-- figures the tier engine used for this drink on this tick, so staff can see
-- how a price was arrived at (workbook tab 10 columns). Null on rows written
-- before this migration and under demand pricing.
alter table public.market_ticks
  add column if not exists units           numeric,
  add column if not exists pace            numeric,
  add column if not exists mins_since_sale integer,
  add column if not exists rank_value      numeric,
  add column if not exists rank_pos        integer,
  add column if not exists tier_pct        numeric,
  add column if not exists target_price    numeric(6,2),
  add column if not exists till_price      numeric(6,2);
