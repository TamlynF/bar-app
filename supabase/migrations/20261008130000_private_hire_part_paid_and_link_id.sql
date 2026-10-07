-- A deposit marked paid for less than was asked is recorded as part paid,
-- and the Square payment link's own id is kept so a checkout the customer
-- no longer needs (paid another way, replaced, or the request closed) can be
-- switched off in Square rather than left payable.

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_payment_status_check,
  add constraint private_hire_requests_payment_status_check
    check (payment_status = any (array['unpaid', 'partially_paid', 'paid']));

alter table public.private_hire_requests
  add column if not exists square_payment_link_id text;
