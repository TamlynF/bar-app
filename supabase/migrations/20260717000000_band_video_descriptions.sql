-- Optional per-video descriptions for band applications. Index-aligned with the
-- existing `video_urls text[]` column (additive; existing readers of video_urls
-- are unaffected). NOTE: apply the same column to the production database.
alter table public.band_booking_requests
  add column if not exists video_descriptions text[] not null default '{}'::text[];
