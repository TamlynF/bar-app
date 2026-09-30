-- Spirits sold with a mixer. The till adds the mixer as a Square modifier
-- (the modifier list chosen in market_settings, at a flat price); the market only ever moves the
-- spirit's own variation price and shows spirit + mixer on the public screens.
--   menu_item_prices.with_mixer      staff flag for serves always sold with a
--                                    mixer that Square does not mark with the
--                                    mixer modifier list
--   stock_market_events.mixer_price  fallback mixer price when Square has no
--                                    Mixer modifier list to read it from
--   market_instruments.mixer_price   the mixer price this drink carries for the
--                                    session, null when it has no mixer

alter table public.menu_item_prices
  add column if not exists with_mixer boolean not null default false;

alter table public.stock_market_events
  add column if not exists mixer_price numeric(6,2) not null default 1.25;

alter table public.stock_market_events
  drop constraint if exists stock_market_events_mixer_price_check;

alter table public.stock_market_events
  add constraint stock_market_events_mixer_price_check check (mixer_price >= 0 and mixer_price <= 20);

alter table public.market_instruments
  add column if not exists mixer_price numeric(6,2);

-- Venue-wide market settings, one row. mixer_mode says which Square modifier
-- list is the mixer the till adds:
--   'list'  exactly mixer_modifier_list_id, whatever it is called
--   'auto'  any modifier list with "mixer" in its name
--   'off'   ignore Square; only serves staff tick "served with a mixer"
-- mixer_modifier_list_name is the list's name when it was chosen, so the
-- settings page can still say what is set while Square is unreachable.
create table if not exists public.market_settings (
  id smallint primary key default 1 check (id = 1),
  mixer_mode text not null default 'auto' check (mixer_mode in ('auto', 'list', 'off')),
  mixer_modifier_list_id text,
  mixer_modifier_list_name text,
  updated_at timestamptz not null default now(),
  updated_by bigint references public.employees(id) on delete set null,
  constraint market_settings_mixer_list_chosen check (mixer_mode <> 'list' or mixer_modifier_list_id is not null)
);

insert into public.market_settings (id) values (1) on conflict (id) do nothing;

alter table public.market_settings enable row level security;

drop policy if exists "Allow authenticated full" on public.market_settings;
create policy "Allow authenticated full" on public.market_settings
  for all to authenticated using (true) with check (true);

grant all on public.market_settings to authenticated, service_role;
