-- Poster artwork for an event, shown on the public What's On cards.
-- Uploaded to the public `booking-images` storage bucket under events/.
alter table public.events add column if not exists image_url text;
