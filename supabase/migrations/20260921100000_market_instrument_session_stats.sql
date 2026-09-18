-- Running totals per drink for the trading floor's expanded panel (workbook
-- tab 10 columns F-J): units sold tonight, the price range, and how many
-- times the tier and the board price have changed. Kept by the tick so the
-- page never has to add up the whole tick history.
alter table public.market_instruments
  add column if not exists units_sold    numeric not null default 0,
  add column if not exists high_price    numeric(6,2),
  add column if not exists low_price     numeric(6,2),
  add column if not exists tier_changes  integer not null default 0,
  add column if not exists price_changes integer not null default 0;
