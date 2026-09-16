-- An instrument is one serve of a drink (market_instruments is unique on
-- session_id + menu_item_price_id and the Square variation lives on
-- menu_item_prices), so the event drink list must be keyed by serve too.
-- Until now it was keyed by menu item and the lowest display_order serve was
-- picked silently when the market opened. Backfill with that same serve so
-- existing events keep trading exactly what they trade today.

alter table public.stock_market_event_items
  add column if not exists menu_item_price_id bigint references public.menu_item_prices(id) on delete cascade;

update public.stock_market_event_items i
set menu_item_price_id = p.id
from (
  select distinct on (menu_item_id) id, menu_item_id
  from public.menu_item_prices
  where amount > 0
  order by menu_item_id, display_order, id
) p
where p.menu_item_id = i.menu_item_id
  and i.menu_item_price_id is null;

-- Items with no priced serve could never open anyway.
delete from public.stock_market_event_items where menu_item_price_id is null;

alter table public.stock_market_event_items
  alter column menu_item_price_id set not null;

alter table public.stock_market_event_items
  drop constraint if exists stock_market_event_items_pkey;

alter table public.stock_market_event_items
  add primary key (event_id, menu_item_price_id);

create index if not exists stock_market_event_items_price_idx
  on public.stock_market_event_items (menu_item_price_id);
