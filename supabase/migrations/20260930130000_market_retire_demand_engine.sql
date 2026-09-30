-- The demand engine is retired: every stock market event now prices on the
-- tier leaderboard. Events still on 'demand' move to 'tiers' first so no
-- event silently changes behaviour when the column goes, then the columns
-- only the demand engine (or the old per-tick glide) read are dropped.
-- market_sessions.config snapshots keep their old keys; the app ignores them.

update public.stock_market_events
  set pricing_mode = 'tiers'
  where pricing_mode <> 'tiers';

alter table public.stock_market_events
  drop constraint if exists stock_market_events_pricing_mode_check;

alter table public.stock_market_events
  drop column if exists pricing_mode,
  drop column if exists noise_sigma,
  drop column if exists glide_pct;
