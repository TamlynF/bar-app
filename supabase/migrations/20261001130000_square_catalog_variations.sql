-- A local copy of the Square catalog, one row per item variation, refreshed
-- by the nightly sync (/api/square/sync). The app links menu serves to Square
-- by variation id; this copy lets pages compare the two without calling
-- Square: till price against menu price, stock tracking, the alcohol flag,
-- modifier lists and Square's own categories. Prices are in pounds.
-- Square keeps two kinds of category on an item: ordinary categories
-- (category_ids/names, which includes the reporting category) and the menu
-- categories that make up Square's Menus (menu_ids/names, each name the full
-- path such as "Don Fenticas Hinckley > Spirits > Liqueurs").
-- inventory_tracking is the variation's own flag; inventory_tracking_location
-- is what applies at the venue (a location override wins); stock_tracking is
-- the variation flag as Square labels it: counted, or not tracked.
-- stock_quantity is Square's in-stock count at the venue (null when it has
-- none); sold_by is the unit abbreviation such as "Btl" (null for each).
-- sold_out_at names the locations where the variation is marked sold out.
-- status is the item's Active/Archived state; status_ext is the label the
-- Square item library shows in its Status column: "Sold out" when marked sold
-- out at the venue, "20 Btl available" when tracked with stock above zero,
-- otherwise "Available".
-- A variation that disappears from Square keeps its row with deleted_at set,
-- so old sale lines can still be named.

create table if not exists public.square_catalog_variations (
  variation_id            text primary key,
  item_id                 text not null,
  item_name               text not null,
  variation_name          text not null default '',
  sku                     text,
  product_type            text,
  pricing_type            text,
  price                   numeric(10, 2),
  currency                text,
  reporting_category_id   text,
  reporting_category_name text,
  category_ids            text[] not null default '{}',
  category_names          text[] not null default '{}',
  menu_ids                text[] not null default '{}',
  menu_names              text[] not null default '{}',
  modifier_list_ids       text[] not null default '{}',
  modifier_list_names     text[] not null default '{}',
  is_alcoholic            boolean not null default false,
  inventory_tracking          boolean not null default false,
  inventory_tracking_location boolean not null default false,
  stock_tracking          text not null default 'not_tracked'
    check (stock_tracking in ('stock_count', 'not_tracked')),
  stock_quantity          numeric,
  sold_by                 text,
  sold_out_at             text[] not null default '{}',
  status                  text not null default 'Active' check (status in ('Active', 'Archived')),
  status_ext              text not null default 'Available',
  sellable                boolean,
  stockable               boolean,
  is_archived             boolean not null default false,
  at_location             boolean not null default true,
  item_updated_at         timestamptz,
  variation_updated_at    timestamptz,
  synced_at               timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists square_catalog_variations_item_idx
  on public.square_catalog_variations (item_id);
create index if not exists square_catalog_variations_reporting_category_idx
  on public.square_catalog_variations (reporting_category_id);

grant all on public.square_catalog_variations to authenticated, service_role;

alter table public.square_catalog_variations enable row level security;
drop policy if exists "Allow authenticated full" on public.square_catalog_variations;
create policy "Allow authenticated full" on public.square_catalog_variations
  for all to authenticated using (true) with check (true);

-- Square's modifier lists, copied by the same refresh, so the mixer price
-- (the list's options and what they cost) is read without calling Square.
-- modifiers holds the options in Square's order, each
--   { "id": text, "name": text, "price": number (pounds) | null }.
create table if not exists public.square_catalog_modifier_lists (
  modifier_list_id text primary key,
  name             text not null default '',
  modifiers        jsonb not null default '[]'::jsonb check (jsonb_typeof(modifiers) = 'array'),
  updated_at       timestamptz,
  synced_at        timestamptz not null default now(),
  deleted_at       timestamptz
);

grant all on public.square_catalog_modifier_lists to authenticated, service_role;

alter table public.square_catalog_modifier_lists enable row level security;
drop policy if exists "Allow authenticated full" on public.square_catalog_modifier_lists;
create policy "Allow authenticated full" on public.square_catalog_modifier_lists
  for all to authenticated using (true) with check (true);

-- The catalog refresh reports separately from the sales sync, so a catalog
-- failure never marks sales history as out of date.
alter table public.square_sync_state
  add column if not exists catalog_synced_at timestamptz,
  add column if not exists catalog_run_at timestamptz,
  add column if not exists catalog_status text,
  add column if not exists catalog_error text,
  add column if not exists catalog_variations integer;
