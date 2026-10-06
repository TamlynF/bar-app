-- booking-images is a public bucket (event posters, event type and subtype
-- images, booking setup images), so its files are served by URL without any
-- policy. The public select policy only let anyone list every file through
-- the API; listing is now for signed-in staff only.
--
-- Uploads and deletes were already signed-in only. The update policy is
-- dropped - every upload in the admin adds a new file - so a live image can't
-- be overwritten, matching the gallery and promo-media buckets. These
-- policies were created in the dashboard; this records them in the repo.

drop policy if exists "booking-images public read" on storage.objects;
drop policy if exists "booking-images auth update" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'booking-images staff read'
  ) then
    create policy "booking-images staff read" on storage.objects
      for select to authenticated using (bucket_id = 'booking-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'booking-images auth insert'
  ) then
    create policy "booking-images auth insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'booking-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'booking-images auth delete'
  ) then
    create policy "booking-images auth delete" on storage.objects
      for delete to authenticated using (bucket_id = 'booking-images');
  end if;
end $$;
