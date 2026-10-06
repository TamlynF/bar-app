-- How many days a private hire customer has to pay the deposit once their
-- times are agreed. The date is held for them until then.

alter table public.company_information
  add column if not exists private_hire_deposit_days integer not null default 7;

alter table public.company_information
  drop constraint if exists company_information_private_hire_deposit_days_check,
  add constraint company_information_private_hire_deposit_days_check
    check (private_hire_deposit_days between 1 and 90);
