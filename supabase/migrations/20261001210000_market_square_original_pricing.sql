-- What a linked variation looked like in Square before the market touched
-- it, beyond the headline price: its pricing type (a variable-priced drink
-- is forced to fixed while it trades) and each location override's own
-- price, so closing the market puts all of it back. A drink is only pushed
-- to the till once this snapshot exists. Null pricing type on older rows
-- means the snapshot predates these columns.

alter table public.market_instruments
  add column if not exists square_original_pricing_type text,
  add column if not exists square_original_location_prices jsonb;
