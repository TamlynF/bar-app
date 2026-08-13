alter table public.quiz_category_configs
  add column if not exists min_years smallint not null default 3,
  add column if not exists max_years smallint not null default 10;

alter table public.quiz_category_configs
  drop constraint if exists quiz_category_configs_year_range_check;

alter table public.quiz_category_configs
  add constraint quiz_category_configs_year_range_check
  check (min_years >= 1 and max_years >= min_years);
