-- admin_notes on a band application only ever held the reason given to the
-- act when it was declined, so it is renamed to say so. Reopening an
-- application now clears it and records the old reason in the Team notes, the
-- same as private hire, so a reason left over on a request that is no longer
-- declined is cleared here too.

alter table public.band_booking_requests
  rename column admin_notes to decline_reason;

update public.band_booking_requests
set decline_reason = null
where status <> 'declined';
