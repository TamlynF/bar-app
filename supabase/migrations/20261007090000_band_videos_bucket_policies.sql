-- band-videos is a public bucket, so act videos play by URL without any
-- policy. The public select policy only let anyone list every video through
-- the API - including ones from declined applications. Listing is now for
-- signed-in staff only.
--
-- Anonymous upload stays: the public band application form uploads videos
-- without signing in. The bucket itself limits uploads to video types up to
-- its file_size_limit. Uploads no longer ask to overwrite (x-upsert false in
-- src/lib/resumable-upload.ts), which is what needed the public select.
-- These policies were created in the dashboard; this records them in the repo.

drop policy if exists "public_read_band_videos" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'band-videos staff read'
  ) then
    create policy "band-videos staff read" on storage.objects
      for select to authenticated using (bucket_id = 'band-videos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'anon_upload_band_videos'
  ) then
    create policy "anon_upload_band_videos" on storage.objects
      for insert to anon, authenticated with check (bucket_id = 'band-videos');
  end if;
end $$;
