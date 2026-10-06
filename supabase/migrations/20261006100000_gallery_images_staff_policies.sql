-- gallery_images let anyone insert, update and delete through the public API
-- key - the policies were "for all users" on every command. Only staff change
-- the gallery (Settings > Gallery, signed in); the public site only reads it.
--
-- Now: anyone can read, only signed-in users can write - the same rule as
-- gallery_categories.

drop policy if exists "Enable insert access for all users" on public.gallery_images;
drop policy if exists "Enable update access for all users" on public.gallery_images;
drop policy if exists "Enable delete access for all users" on public.gallery_images;
drop policy if exists "Enable read access for all users" on public.gallery_images;

alter table public.gallery_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gallery_images' and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.gallery_images
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gallery_images' and policyname = 'Allow anon read'
  ) then
    create policy "Allow anon read" on public.gallery_images
      for select to anon using (true);
  end if;
end $$;
