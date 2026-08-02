-- Square venue sales - schema.
--
-- Backs the admin dashboard "Venue Sales" section. A scheduled job
-- (/api/square/sync, Vercel Cron) pulls completed Square orders into
-- square_sales (one row per Square order), flattened so the dashboard can
-- read takings/tips/fees/refunds and per-category splits straight from
-- Supabase - matching the app's "reads come from Supabase" pattern rather
-- than hitting the Square API on every page load.
--
-- These are ACTUAL venue takings (bar + food + POS), kept DISTINCT from the
-- app's pre-booked booking revenue; the dashboard never sums the two.
-- All additive + idempotent.

-- ── square_sales - one row per Square order ──────────────────────────────────
create table if not exists public.square_sales (
  square_order_id    text not null,
  location_id        text,
  business_date      date not null,            -- local trading day the order closed
  created_at         timestamptz not null,     -- Square order created_at
  currency           text not null default 'GBP',
  -- All monetary columns are in major units (£), not Square minor units.
  gross_sales        numeric not null default 0,  -- sum of line items before discounts
  discounts          numeric not null default 0,
  net_sales          numeric not null default 0,  -- gross - discounts (goods/services only)
  tips               numeric not null default 0,
  fees               numeric not null default 0,  -- Square processing fees
  refunds            numeric not null default 0,  -- refunded against this order
  total_collected    numeric not null default 0,  -- net + tips - refunds (what actually landed)
  -- Per-category split of net_sales, e.g. {"drinks": 640.0, "food": 120.0, "tickets": 0, "other": 15}
  category_breakdown jsonb not null default '{}'::jsonb,
  source             text not null default 'square',
  raw                jsonb,                       -- original order payload, for reprocessing
  synced_at          timestamptz not null default now()
);

alter table public.square_sales
  drop constraint if exists square_sales_pkey;
alter table public.square_sales
  add constraint square_sales_pkey primary key (square_order_id);

create index if not exists square_sales_business_date_idx
  on public.square_sales (business_date);
create index if not exists square_sales_created_at_idx
  on public.square_sales (created_at);

-- ── square_sync_state - single row, tracks incremental sync watermark ─────────
create table if not exists public.square_sync_state (
  id             integer not null default 1,
  last_synced_at timestamptz,                 -- high-water mark: orders updated after this are re-pulled
  last_run_at    timestamptz,
  last_status    text,                        -- 'ok' | 'error'
  last_error     text,
  orders_synced  integer not null default 0,  -- count from the most recent run
  updated_at     timestamptz not null default now(),
  constraint square_sync_state_singleton check (id = 1)
);

alter table public.square_sync_state
  drop constraint if exists square_sync_state_pkey;
alter table public.square_sync_state
  add constraint square_sync_state_pkey primary key (id);

insert into public.square_sync_state (id)
  values (1)
  on conflict (id) do nothing;

-- ── Grants (RLS off on the local test DB; prod auto-applies its own) ──────────
grant all on public.square_sales      to anon, authenticated, service_role;
grant all on public.square_sync_state to anon, authenticated, service_role;
