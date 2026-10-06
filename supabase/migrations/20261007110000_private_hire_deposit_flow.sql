-- Private hire requests now move through review, an optional time proposal
-- and a deposit before they are confirmed:
--   new -> awaiting_customer -> awaiting_deposit -> confirmed
-- with declined, cancelled and expired as the closed outcomes. The event is
-- only created once the deposit is paid. 'pending' stays as a legacy alias of
-- 'new' (the app reads the two as one) so rows and code from before this
-- change keep working until the deploy lands.

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_status_check;

update public.private_hire_requests set status = 'declined' where status = 'cancelled' and event_id is null;

alter table public.private_hire_requests
  alter column status set default 'new',
  add constraint private_hire_requests_status_check check (
    status = any (array[
      'new', 'awaiting_customer', 'awaiting_deposit', 'confirmed',
      'declined', 'cancelled', 'expired', 'pending'
    ])
  );

alter table public.private_hire_requests
  add column if not exists proposed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists deposit_due_date date,
  add column if not exists deposit_reminded_at timestamptz,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_paid_via text,
  add column if not exists payment_link_url text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists closed_at timestamptz;

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_deposit_paid_via_check,
  add constraint private_hire_requests_deposit_paid_via_check check (
    deposit_paid_via is null
    or deposit_paid_via = any (array['square', 'bank_transfer', 'cash', 'other', 'none'])
  );

update public.private_hire_requests
  set confirmed_at = coalesce(updated_at, created_at)
  where status = 'confirmed' and confirmed_at is null;

update public.private_hire_requests
  set closed_at = coalesce(updated_at, created_at)
  where status in ('declined', 'cancelled') and closed_at is null;

create index if not exists private_hire_requests_square_order_id_idx
  on public.private_hire_requests (square_order_id)
  where square_order_id is not null;

create index if not exists private_hire_requests_awaiting_deposit_idx
  on public.private_hire_requests (deposit_due_date)
  where status = 'awaiting_deposit';
