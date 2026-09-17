-- Board shows a price only once Square has confirmed the catalog write
-- (plan §7). square_last_write_at is stamped by the tick's batched upsert;
-- square_catalog_confirmed_at by the catalog.version.updated webhook, which
-- also copies each instrument's synced price into square_confirmed_price.

alter table public.market_sessions
  add column if not exists square_last_write_at timestamptz,
  add column if not exists square_catalog_confirmed_at timestamptz;

alter table public.market_instruments
  add column if not exists square_confirmed_price numeric;
