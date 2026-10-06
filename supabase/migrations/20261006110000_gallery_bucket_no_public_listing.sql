-- The gallery bucket is public, so its files are served by URL without any
-- policy. The "Public read gallery" select policy only added the ability for
-- anyone to list every file in the bucket through the API - including uploads
-- that were never published or have been taken down. Listing is now for
-- signed-in staff only; public URLs keep working.
--
-- Uploads stay signed-in only and there is still no update policy, so files
-- can't be overwritten. These policies were created in the dashboard, so this
-- is also the first time they are recorded in the repo.

drop policy if exists "Public read gallery" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Staff read gallery'
  ) then
    create policy "Staff read gallery" on storage.objects
      for select to authenticated using (bucket_id = 'gallery');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth upload gallery'
  ) then
    create policy "Auth upload gallery" on storage.objects
      for insert to authenticated with check (bucket_id = 'gallery');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth delete gallery'
  ) then
    create policy "Auth delete gallery" on storage.objects
      for delete to authenticated using (bucket_id = 'gallery');
  end if;
end $$;
