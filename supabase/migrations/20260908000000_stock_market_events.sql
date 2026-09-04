-- Stock market events: reusable, named market-night templates carrying their
-- own engine settings and drink list. A market_sessions row records which
-- event it was opened from.

create table if not exists public.stock_market_events (
  id                  bigint generated always as identity primary key,
  name                text not null,
  open_time           time not null,
  close_time          time not null,
  tick_interval_sec   integer not null default 60,
  noise_sigma         numeric not null default 0.015,
  floor_pct           numeric not null default 0.7,
  ceil_pct            numeric not null default 1.5,
  move_notify_pct     numeric not null default 0.05,
  low_stock_threshold integer not null default 5,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          bigint references public.employees(id) on delete set null,
  updated_at          timestamptz not null default now(),
  updated_by          bigint references public.employees(id) on delete set null
);

create index if not exists stock_market_events_active_name_idx
  on public.stock_market_events (is_active, name);

create table if not exists public.stock_market_event_items (
  event_id     bigint not null references public.stock_market_events(id) on delete cascade,
  menu_item_id bigint not null references public.menu_items(id) on delete cascade,
  primary key (event_id, menu_item_id)
);

create index if not exists stock_market_event_items_menu_item_idx
  on public.stock_market_event_items (menu_item_id);

alter table public.market_sessions
  add column if not exists stock_market_event_id bigint references public.stock_market_events(id) on delete set null;

create index if not exists market_sessions_stock_market_event_idx
  on public.market_sessions (stock_market_event_id);

-- RLS off on the local test DB; prod auto-applies its own.
grant all on public.stock_market_events to anon, authenticated, service_role;
grant all on public.stock_market_event_items to anon, authenticated, service_role;
