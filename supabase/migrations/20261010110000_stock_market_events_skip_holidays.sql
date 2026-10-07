-- "Bank holiday eve" (a weekday profile to borrow on the night before a bank
-- holiday) becomes a plain switch: skip_holidays leaves bank holidays and
-- their eves out of the sales history that sets each drink's normal. On by
-- default, which was the existing behaviour; the profile swap at open is
-- retired, so a bank holiday eve ranks against its real weekday.

alter table public.stock_market_events
  add column if not exists skip_holidays boolean not null default true;

alter table public.stock_market_events
  drop column if exists bank_holiday_profile;
