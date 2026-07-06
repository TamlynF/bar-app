-- Booking-navigation title for the taxonomy rows that own a booking page.
-- Which row supplies the label depends on the category's booking_grouping:
--   per_type    → event_types.title
--   per_subtype → event_subtypes.title
--   per_event   → events.title (already exists)
-- Admin/public booking navigation uses this instead of booking_card_title.
-- Nullable at the DB level (existing rows have no value yet); the admin form makes
-- it mandatory for per_type categories and per_subtype sub-types.
alter table public.event_types
  add column if not exists title text;

alter table public.event_subtypes
  add column if not exists title text;
