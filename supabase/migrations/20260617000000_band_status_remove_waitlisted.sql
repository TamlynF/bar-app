-- Retire the `waitlisted` status from band_booking_requests.
--
-- `waitlisted` is no longer settable from the app (removed from the BandStatus
-- type and the admin UI). Move any existing waitlisted applications back to the
-- review queue (`pending` — which has the same "linked event is inactive"
-- behaviour), then replace the status CHECK constraint so the database rejects
-- `waitlisted` as well.

update public.band_booking_requests
set status = 'pending'
where status = 'waitlisted';

alter table public.band_booking_requests
  drop constraint if exists band_booking_requests_status_check;

alter table public.band_booking_requests
  add constraint band_booking_requests_status_check
  check ((status = any (array['pending'::text, 'confirmed'::text, 'cancelled'::text])));
