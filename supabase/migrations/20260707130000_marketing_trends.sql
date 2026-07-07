-- Marketing Trends & Competitor Insights — schema.
--
-- Backs the admin "Marketing" section: AI/web-sourced advertising & competitor-event
-- trends staff can save/ignore, local competitor drink/snack/food prices for menu
-- comparison, and a single-row settings record holding the editable comparison area.
-- All additive + idempotent. IDs use uuid to match the app's "generated content"
-- tables (band/private requests, generated quiz questions).

-- ── marketing_trends — one row per AI-surfaced trend ─────────────────────────
create table if not exists public.marketing_trends (
  id          uuid not null default gen_random_uuid(),
  kind        text not null,               -- 'advertising' | 'event_idea'
  title       text not null,
  summary     text,
  relevance   text,                         -- why it matters now / current-events tie-in
  category    text,                         -- e.g. reel, meme, seasonal, theme_night
  source_url  text,
  source_name text,
  tags        text[] not null default '{}'::text[],
  state       text not null default 'new',  -- 'new' | 'saved' | 'ignored'
  signature   text,                          -- dedupe key (normalised title+source)
  area        text,
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  integer,
  updated_by  integer
);

alter table public.marketing_trends
  drop constraint if exists marketing_trends_pkey;
alter table public.marketing_trends
  add constraint marketing_trends_pkey primary key (id);

alter table public.marketing_trends
  drop constraint if exists marketing_trends_kind_check;
alter table public.marketing_trends
  add constraint marketing_trends_kind_check check (kind in ('advertising', 'event_idea'));

alter table public.marketing_trends
  drop constraint if exists marketing_trends_state_check;
alter table public.marketing_trends
  add constraint marketing_trends_state_check check (state in ('new', 'saved', 'ignored'));

-- Dedupe: a given trend (by signature) is only ever stored once, so a refresh
-- never resurfaces a trend the user already saved or ignored. A plain (non-partial)
-- unique index is required so it can serve as the ON CONFLICT arbiter for upserts;
-- signature is always set by the app, and Postgres treats NULLs as distinct.
create unique index if not exists marketing_trends_signature_key
  on public.marketing_trends (signature);
create index if not exists marketing_trends_state_idx on public.marketing_trends (state);
create index if not exists marketing_trends_kind_idx  on public.marketing_trends (kind);

-- ── competitor_prices — local competitor price data points ───────────────────
create table if not exists public.competitor_prices (
  id           uuid not null default gen_random_uuid(),
  venue_name   text not null,
  item_name    text not null,
  item_type    text,                        -- 'drink' | 'snack' | 'food'
  price_text   text,                         -- raw as sourced, e.g. "£4.50"
  price_amount numeric,                       -- parsed GBP for comparison (nullable)
  area         text,
  source_url   text,
  source_name  text,
  fetched_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.competitor_prices
  drop constraint if exists competitor_prices_pkey;
alter table public.competitor_prices
  add constraint competitor_prices_pkey primary key (id);

alter table public.competitor_prices
  drop constraint if exists competitor_prices_item_type_check;
alter table public.competitor_prices
  add constraint competitor_prices_item_type_check check (item_type in ('drink', 'snack', 'food'));

create index if not exists competitor_prices_area_idx on public.competitor_prices (area);

-- ── marketing_settings — single row (like company_information) ────────────────
create table if not exists public.marketing_settings (
  id                     uuid not null default gen_random_uuid(),
  comparison_area        text,
  comparison_radius      text,
  last_trends_refresh_at timestamptz,
  last_prices_refresh_at timestamptz,
  updated_at             timestamptz not null default now(),
  updated_by             integer
);

alter table public.marketing_settings
  drop constraint if exists marketing_settings_pkey;
alter table public.marketing_settings
  add constraint marketing_settings_pkey primary key (id);

-- ── Grants (RLS off on the local test DB; prod auto-applies its own) ──────────
grant all on public.marketing_trends   to anon, authenticated, service_role;
grant all on public.competitor_prices  to anon, authenticated, service_role;
grant all on public.marketing_settings to anon, authenticated, service_role;
