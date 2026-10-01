-- Menu items and serves that exist only so a Square variation has something
-- to link to (created from Settings -> Stock market -> Square links when the
-- menu has no matching serve). They trade on the market like any other serve
-- but stay off the public menu, the marketing menu and the admin menu editor.
-- show_on_menu = false on an item hides the whole item; on a serve it hides
-- that serve only, so a hidden "pitcher" can sit beside a listed pint.

alter table public.menu_items
  add column if not exists show_on_menu boolean not null default true;

alter table public.menu_item_prices
  add column if not exists show_on_menu boolean not null default true;
