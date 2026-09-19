-- Per-event switch for Market Night phone alerts. Off hides the "Notify me"
-- button on the public page and stops the tick fanning alerts out to
-- subscribed phones; existing subscriptions are kept for the next night.
alter table public.stock_market_events
  add column if not exists push_alerts_enabled boolean not null default true;
