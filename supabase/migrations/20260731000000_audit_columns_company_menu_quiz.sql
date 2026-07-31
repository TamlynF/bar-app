alter table public.company_information
  add column if not exists created_by bigint references public.employees(id) on delete set null,
  add column if not exists updated_by bigint references public.employees(id) on delete set null;

alter table public.menu_categories
  add column if not exists created_by bigint references public.employees(id) on delete set null,
  add column if not exists updated_by bigint references public.employees(id) on delete set null;

alter table public.menu_items
  add column if not exists created_by bigint references public.employees(id) on delete set null,
  add column if not exists updated_by bigint references public.employees(id) on delete set null;

alter table public.quiz_category_configs
  add column if not exists created_by bigint references public.employees(id) on delete set null,
  add column if not exists updated_by bigint references public.employees(id) on delete set null;

update public.company_information
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

alter table public.company_information
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
