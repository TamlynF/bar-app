-- band_notes (a single free-text staff note about the act) was superseded by
-- the band_booking_notes list and nothing in the app reads or writes it.

alter table public.band_booking_requests
  drop column if exists band_notes;
