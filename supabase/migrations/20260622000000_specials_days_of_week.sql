-- Specials can optionally run only on certain days of the week (e.g. a
-- Tuesday cocktail deal, or a Fri+Sat late-night offer). Stored as an array of
-- ISO weekday numbers (1 = Monday … 7 = Sunday). An empty array means the
-- special runs every day it is active — the home page reads this to render the
-- "Available on" day pills in the special detail view.
alter table public.specials
  add column if not exists days_of_week smallint[] not null default '{}'::smallint[];

comment on column public.specials.days_of_week is
  'ISO weekday numbers (1=Mon … 7=Sun) the special is available on. Empty = all days.';
