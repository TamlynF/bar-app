-- Acts answer an offer from their own page (/band-offer/<id>), the way private
-- hire customers do. act_accepted_at records their yes - set alongside
-- status = booked, or on its own when the slot had a clash and staff still
-- have to book it by hand. act_withdrawn_at is set when the act pulls out,
-- which moves the request to declined with no reason given.

alter table public.band_booking_requests
  add column if not exists act_accepted_at timestamp with time zone,
  add column if not exists act_withdrawn_at timestamp with time zone;
