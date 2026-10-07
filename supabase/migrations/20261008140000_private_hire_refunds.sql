-- Deposit refunds made from the app. A card refund goes through Square and
-- completes asynchronously (its id and status are kept so the webhook can
-- close it off); a refund paid back by hand is recorded as completed straight
-- away. Part of a deposit can be refunded, so the amount is kept separately
-- and payment_status only becomes 'refunded' once everything paid is back.

alter table public.private_hire_requests
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_via text,
  add column if not exists square_refund_id text,
  add column if not exists refund_status text;

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_payment_status_check,
  add constraint private_hire_requests_payment_status_check
    check (payment_status = any (array['unpaid', 'partially_paid', 'paid', 'refunded']));

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_refunded_via_check,
  add constraint private_hire_requests_refunded_via_check check (
    refunded_via is null
    or refunded_via = any (array['square', 'bank_transfer', 'cash', 'other'])
  );

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_refund_status_check,
  add constraint private_hire_requests_refund_status_check check (
    refund_status is null
    or refund_status = any (array['pending', 'completed', 'failed'])
  );

create index if not exists private_hire_requests_square_refund_id_idx
  on public.private_hire_requests (square_refund_id)
  where square_refund_id is not null;
