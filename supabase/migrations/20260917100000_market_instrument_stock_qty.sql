-- The tick already reads each linked serve's IN_STOCK count from Square
-- inventory to decide ok / low / out; keep the number so the trading floor
-- can show it. Null = unknown (unlinked, or Square has not answered yet).

alter table public.market_instruments
  add column if not exists stock_qty numeric;
