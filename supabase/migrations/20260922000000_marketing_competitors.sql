-- Rivals the price-off compares against. Places discovery auto-pins nearby
-- pubs; staff unpin noise and capture a menu URL or drinks-board photo.

create table if not exists public.marketing_competitors (
  id                   uuid not null default gen_random_uuid(),
  place_id             text,
  name                 text not null,
  website              text,
  menu_url             text,
  address              text,
  area                 text,
  is_pinned            boolean not null default true,
  last_captured_at     timestamptz,
  last_capture_source  text,
  fetched_at           timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint marketing_competitors_pkey primary key (id),
  constraint marketing_competitors_capture_source_check
    check (last_capture_source is null or last_capture_source in ('website', 'menu_url', 'upload'))
);

create unique index if not exists marketing_competitors_place_id_uidx
  on public.marketing_competitors (place_id)
  where place_id is not null;

create index if not exists marketing_competitors_area_idx
  on public.marketing_competitors (area);

alter table public.competitor_prices
  add column if not exists competitor_id uuid references public.marketing_competitors (id) on delete cascade;

create index if not exists competitor_prices_competitor_id_idx
  on public.competitor_prices (competitor_id);

grant all on public.marketing_competitors to anon, authenticated, service_role;
