-- promo-media is a public bucket, so promo images and videos are served by URL
-- without any policy. Its "Public read" select policy only let anyone list
-- every file through the API, including ones no longer on the site; listing
-- is now for signed-in staff only.
--
-- The write policies applied to every role and checked auth.role() inside;
-- they are now granted to the authenticated role directly. The update policy
-- is dropped - Settings > Promo content only ever uploads new files - so a
-- file can't be overwritten once it's live, matching the gallery bucket.
-- These policies were created in the dashboard; this records them in the repo.

drop policy if exists "Public read promo-media" on storage.objects;
drop policy if exists "Authenticated upload promo-media" on storage.objects;
drop policy if exists "Authenticated update promo-media" on storage.objects;
drop policy if exists "Authenticated delete promo-media" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Staff read promo-media'
  ) then
    create policy "Staff read promo-media" on storage.objects
      for select to authenticated using (bucket_id = 'promo-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth upload promo-media'
  ) then
    create policy "Auth upload promo-media" on storage.objects
      for insert to authenticated with check (bucket_id = 'promo-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth delete promo-media'
  ) then
    create policy "Auth delete promo-media" on storage.objects
      for delete to authenticated using (bucket_id = 'promo-media');
  end if;
end $$;
