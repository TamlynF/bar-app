-- The menu category each Square variation belongs to. It follows the menu
-- serve the variation is linked to (menu_item_prices.square_variation_id ->
-- menu_items.category_id) until staff pick one by hand, which sets
-- menu_category_manual and is then kept whatever the link does. Square items
-- with no menu serve (merchandise, happy-hour bottles) can still be given a
-- category by hand. The nightly catalog sync never writes these columns.

alter table public.square_catalog_variations
  add column if not exists menu_category_id bigint
    references public.menu_categories (id) on delete set null,
  add column if not exists menu_category_manual boolean not null default false;

create index if not exists square_catalog_variations_menu_category_idx
  on public.square_catalog_variations (menu_category_id);

update public.square_catalog_variations v
set menu_category_id = linked.category_id
from (
  select distinct on (p.square_variation_id) p.square_variation_id, i.category_id
  from public.menu_item_prices p
  join public.menu_items i on i.id = p.menu_item_id
  where p.square_variation_id is not null
  order by p.square_variation_id, p.id
) linked
where v.variation_id = linked.square_variation_id
  and not v.menu_category_manual;
