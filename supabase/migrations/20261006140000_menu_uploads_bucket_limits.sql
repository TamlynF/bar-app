-- menu-uploads (private; staff read and upload) had no size or type limits on
-- the bucket itself, so anything uploaded straight to storage - rather than
-- through Settings > Menu > Import - was accepted whatever it was. The bucket
-- now enforces the same limits the import action checks: 15 MB, and a PDF,
-- PNG, JPEG or WebP.
--
-- There is still no delete policy on purpose: imported files are kept as the
-- audit trail behind each menu_imports row.

update storage.buckets
set
  file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'menu-uploads';
