-- Which nights a band can ask to play on the public stage form. Weekdays are
-- 0 (Sunday) to 6 (Saturday); bank holidays open the night before each one.

alter table public.company_information
  add column if not exists band_request_weekdays smallint[] not null default '{5,6}',
  add column if not exists band_request_bank_holidays boolean not null default true;

alter table public.company_information
  drop constraint if exists company_information_band_request_weekdays_check,
  add constraint company_information_band_request_weekdays_check
    check (band_request_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
