-- A private hire deposit is now empty until staff set one: null means "use
-- the company default", and 0 means staff waived it. The column used to
-- default to 0, so every request that hasn't been approved yet carries a 0
-- that only ever meant "not set" - those go back to null. Approved and
-- confirmed requests keep the amount they were agreed at.

alter table public.private_hire_requests
  alter column deposit_amount drop default;

update public.private_hire_requests
  set deposit_amount = null
  where deposit_amount = 0
    and approved_at is null
    and confirmed_at is null;
