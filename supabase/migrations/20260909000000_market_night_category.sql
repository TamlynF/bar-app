-- Drinks created for a single market night live in a hidden menu category.
-- The flag lets the market pages find that category without matching on name.

alter table public.menu_categories
  add column if not exists market_only boolean not null default false;

create index if not exists menu_categories_market_only_idx
  on public.menu_categories (market_only)
  where market_only = true;
