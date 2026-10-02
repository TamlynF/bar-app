-- Deposit shown on the public private hire form and refunded against the
-- group's bar spend on the night. Editable on Settings -> Company.
alter table public.company_information
  add column if not exists private_hire_deposit numeric(10, 2) default 500;

update public.company_information
  set private_hire_deposit = 500
  where private_hire_deposit is null;
