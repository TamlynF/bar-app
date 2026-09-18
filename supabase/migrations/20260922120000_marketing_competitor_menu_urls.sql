-- Multiple drinks-menu pages/PDFs per rival. The old single menu_url is copied in.

alter table public.marketing_competitors
  add column if not exists menu_urls text[] not null default '{}';

update public.marketing_competitors
  set menu_urls = array[menu_url]
  where menu_url is not null
    and btrim(menu_url) <> ''
    and (menu_urls is null or cardinality(menu_urls) = 0);
