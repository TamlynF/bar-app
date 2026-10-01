-- The name a drink trades under on this event: what the board, the phone
-- page and the big screen show once the market opens. It starts as the menu
-- item's name when the drink is added to the event and can be changed on the
-- event's drink sheet without touching the menu. Null reads as the menu name.

alter table public.stock_market_event_items
  add column if not exists display_name text;

update public.stock_market_event_items e
set display_name = i.name
from public.menu_items i
where i.id = e.menu_item_id
  and e.display_name is null;
