-- Rename the private_hire_requests `pending_review` status to `pending`.
--
-- Aligns private hire with the rest of the app's status vocabulary (band/quiz/etc
-- all use `pending`). Migrate any existing rows, switch the column default, then
-- replace the status CHECK constraint so the database accepts `pending` and
-- rejects the retired `pending_review`.

update public.private_hire_requests
set status = 'pending'
where status = 'pending_review';

alter table public.private_hire_requests
  alter column status set default 'pending';

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_status_check;

alter table public.private_hire_requests
  add constraint private_hire_requests_status_check
  check ((status = any (array['pending'::text, 'confirmed'::text, 'rejected'::text])));
