-- Which menu categories are alcoholic drinks. Items the app creates in
-- Square (Send menu to Square, sandbox seeding) carry it as is_alcoholic,
-- Square's alcohol setting on a "Prepared food and beverage" item. Off by
-- default so soft drinks and food are never marked by accident.

alter table public.menu_categories
  add column if not exists is_alcoholic boolean not null default false;
