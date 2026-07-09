-- Expand band_booking_requests to the five-stage application pipeline:
--   new → reviewing → offered → booked → declined
--
-- Replaces the pending/confirmed/cancelled model. Mapping of existing rows:
--   pending   → new       (back to the top of the triage queue)
--   confirmed → booked    (same behaviour: linked event stays active)
--   cancelled → declined
--
-- Constraint is dropped first so the remapped values can be written, then
-- re-added with the new value set.

alter table public.band_booking_requests
  drop constraint if exists band_booking_requests_status_check;

update public.band_booking_requests set status = 'new'      where status = 'pending';
update public.band_booking_requests set status = 'booked'   where status = 'confirmed';
update public.band_booking_requests set status = 'declined' where status = 'cancelled';

alter table public.band_booking_requests
  add constraint band_booking_requests_status_check
  check ((status = any (array['new'::text, 'reviewing'::text, 'offered'::text, 'booked'::text, 'declined'::text])));

alter table public.band_booking_requests
  alter column status set default 'new';
