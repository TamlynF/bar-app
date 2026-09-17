-- Tier leaderboard pricing (docs/market-tier-engine-plan.md, workbook tab 10).
-- A second pricing_mode per stock market event; the demand engine is untouched
-- and stays the default, so nothing changes until staff pick 'tiers' on an event.

alter table public.stock_market_events
  add column if not exists pricing_mode text not null default 'demand',
  add column if not exists rerank_every_ticks integer not null default 5,
  add column if not exists glide_pct numeric not null default 0.35,
  add column if not exists warmup_units integer not null default 30,
  add column if not exists tier_pcts jsonb not null
    default '{"down":[0.30,0.20,0.10],"up":[0.30,0.20,0.10],"bands":[5,10,15]}'::jsonb,
  add column if not exists pace_floor_units numeric not null default 8,
  add column if not exists session_ticks_hint integer not null default 120,
  add column if not exists weekdays integer[] not null default '{}',
  add column if not exists bank_holiday_profile integer,
  add column if not exists history_from date,
  add column if not exists history_to date,
  add column if not exists exclude_market_nights boolean not null default true;

alter table public.stock_market_events
  drop constraint if exists stock_market_events_pricing_mode_check;
alter table public.stock_market_events
  add constraint stock_market_events_pricing_mode_check
  check (pricing_mode in ('demand', 'tiers'));

alter table public.stock_market_event_items
  add column if not exists normal_units_per_night numeric;

-- Cache of "what this serve normally sells on a <weekday> night", built from
-- Square order history (plan §3.4). Weekday 0 = Sunday … 6 = Saturday.
create table if not exists public.market_normal_units (
  menu_item_price_id bigint not null references public.menu_item_prices(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  units_avg numeric not null,
  nights_sampled integer not null,
  sampled_dates date[] not null default '{}',
  computed_at timestamptz not null default now(),
  primary key (menu_item_price_id, weekday)
);

create table if not exists public.uk_bank_holidays (
  date date primary key,
  title text not null,
  fetched_at timestamptz not null default now()
);

alter table public.market_instruments
  add column if not exists normal_units_per_night numeric,
  add column if not exists normal_units_source text,
  add column if not exists pace numeric not null default 0,
  add column if not exists last_sale_tick integer,
  add column if not exists rank_pos integer,
  add column if not exists tier_pct numeric not null default 0,
  add column if not exists target_price numeric;

alter table public.market_sessions
  add column if not exists units_sold_total integer not null default 0,
  add column if not exists warmed_up_tick integer,
  add column if not exists last_rerank_tick integer;

-- market_events.kind is free text (see 20260820000000); the tier engine adds
-- 'tier_up', 'tier_down', 'rerank' and 'warmup_done'.

grant all on public.market_normal_units to anon, authenticated, service_role;
grant all on public.uk_bank_holidays    to anon, authenticated, service_role;
