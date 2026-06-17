-- Rename the private_hire_requests `rejected` status to `cancelled`.
--
-- Brings private hire fully in line with band_booking_requests
-- (`pending` / `confirmed` / `cancelled`). Migrate existing rows, then replace the
-- CHECK constraint so the database accepts `cancelled` and rejects `rejected`.

update public.private_hire_requests
set status = 'cancelled'
where status = 'rejected';

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_status_check;

alter table public.private_hire_requests
  add constraint private_hire_requests_status_check
  check ((status = any (array['pending'::text, 'confirmed'::text, 'cancelled'::text])));
