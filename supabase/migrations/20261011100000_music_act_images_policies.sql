-- Prod switches row-level security on for every new table, so the policies
-- are spelled out: staff do everything, the public site reads posters for
-- the What's On pages, and the band form inserts the poster it uploads.

alter table public.music_act_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'music_act_images' and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.music_act_images
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'music_act_images' and policyname = 'Allow anon read'
  ) then
    create policy "Allow anon read" on public.music_act_images
      for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'music_act_images' and policyname = 'Allow anon insert'
  ) then
    create policy "Allow anon insert" on public.music_act_images
      for insert to anon with check (true);
  end if;
end $$;
