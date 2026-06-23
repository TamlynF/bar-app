-- Per-card branding for the public /book "Upcoming Events" cards. Which row owns
-- a card depends on the category's booking_grouping:
--   per_event   → events
--   per_subtype → event_subtypes
--   per_type    → event_types
-- so the same four fields live on all three tables. All nullable; blank fields
-- fall back to the existing title / dynamic badge / calendar glyph on the card.
alter table public.event_types
  add column if not exists booking_card_title text,
  add column if not exists booking_card_tagline text,
  add column if not exists booking_card_icon text,
  add column if not exists booking_card_badge text;

alter table public.event_subtypes
  add column if not exists booking_card_title text,
  add column if not exists booking_card_tagline text,
  add column if not exists booking_card_icon text,
  add column if not exists booking_card_badge text;

alter table public.events
  add column if not exists booking_card_title text,
  add column if not exists booking_card_tagline text,
  add column if not exists booking_card_icon text,
  add column if not exists booking_card_badge text;
