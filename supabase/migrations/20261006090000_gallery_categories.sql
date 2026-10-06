-- Gallery photos and videos are grouped into categories - Outside, Karaoke
-- nights and so on. The home page shows one tile per category and each
-- category has its own page at /gallery/<slug>.
--
-- An item can sit in several categories, so the link lives in its own table.
-- Removing a category or an item removes its links, never the media itself;
-- an item left with no category shows under "Everything else". The slug
-- "everything-else" is reserved for that page.
--
-- cover_image_id picks the category's tile image; null uses its newest item.

create table if not exists public.gallery_categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug <> 'everything-else'),
  cover_image_id bigint references public.gallery_images(id) on delete set null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by integer references public.employees(id) on delete set null,
  updated_by integer references public.employees(id) on delete set null
);

create table if not exists public.gallery_image_categories (
  image_id bigint not null references public.gallery_images(id) on delete cascade,
  category_id bigint not null references public.gallery_categories(id) on delete cascade,
  primary key (image_id, category_id)
);

create index if not exists gallery_image_categories_category_idx
  on public.gallery_image_categories (category_id);

alter table public.gallery_categories enable row level security;
alter table public.gallery_image_categories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['gallery_categories', 'gallery_image_categories'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'Allow authenticated full'
    ) then
      execute format(
        'create policy "Allow authenticated full" on public.%I for all to authenticated using (true) with check (true)', t
      );
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'Allow anon read'
    ) then
      execute format('create policy "Allow anon read" on public.%I for select to anon using (true)', t);
    end if;
  end loop;
end $$;

grant all on public.gallery_categories to anon, authenticated, service_role;
grant all on public.gallery_image_categories to anon, authenticated, service_role;

insert into public.gallery_categories (name, slug, display_order)
values
  ('Outside', 'outside', 1),
  ('Inside the bar', 'inside-the-bar', 2),
  ('Live bands', 'live-bands', 3),
  ('Karaoke nights', 'karaoke-nights', 4),
  ('Quiz nights', 'quiz-nights', 5),
  ('Food and drink', 'food-and-drink', 6)
on conflict (slug) do nothing;
