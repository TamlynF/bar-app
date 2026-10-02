-- Spotify profile snapshot taken when a band applies: the artist's picture
-- and follower count, read from the Spotify Web API on submit.
alter table public.band_booking_requests
  add column if not exists spotify_image_url text,
  add column if not exists spotify_followers integer;
