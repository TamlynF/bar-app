-- Whether Square tracks stock for a live drink at the venue's location.
-- Spirits are counted by bottle at stocktake, so staff turn Square's stock
-- tracking off for them; Square still returns the last count it had, which
-- would pin a drink at "sold out" or "running low" all night. The market
-- reads this at open (and on every catalog change) and ignores Square's
-- count for untracked drinks. Null = not checked yet, read counts as before.

alter table public.market_instruments
  add column if not exists stock_tracked boolean;
