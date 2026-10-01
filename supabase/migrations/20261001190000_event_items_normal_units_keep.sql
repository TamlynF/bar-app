-- Whether a drink's normal-units override on an event outlives the market
-- night it was set for. Closing a market clears normal_units_per_night on
-- that event's drinks unless normal_units_keep is ticked, so a one-night
-- figure goes back to the Square-history auto value afterwards.

alter table public.stock_market_event_items
  add column if not exists normal_units_keep boolean not null default false;
