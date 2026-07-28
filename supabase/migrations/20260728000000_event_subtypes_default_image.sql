-- Default poster artwork for every event of a sub-category, shown on the public
-- What's On cards when the event itself has no image of its own.
--
-- Events do NOT copy this value. events.image_url stays null unless an admin
-- overrides it, and the image is resolved at render time (see
-- src/lib/event-image.ts) in the order:
--   event.image_url -> music_acts.cover_image_url -> event_subtypes.default_image_url
-- so changing this column updates every non-overridden event immediately.
--
-- Uploaded to the public `booking-images` bucket under event-subtypes/.
--
-- NOTE: the public event query reaches music_acts.cover_image_url by embedding
-- band_booking_requests -> music_acts with the anon key. If RLS is ever enabled
-- on those tables, anon SELECT must remain permitted or event posters break.
--
-- NOTE: apply the same schema to the production database.

alter table public.event_subtypes add column if not exists default_image_url text;
