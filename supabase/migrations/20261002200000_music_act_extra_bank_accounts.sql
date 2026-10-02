-- An act can be paid into more than one account - a member's own account one
-- month, the band account the next. bank_* stays the main account; any other
-- account the act has given us is kept here as a list of
-- {account_name, account_no, sort_code, payment_ref, source, added_at}.
--
-- The weekly invoice request reads bank details out of the invoice an act
-- sends back: an act with no main account gets it there, an act that already
-- has one gets the new account added to this list.

alter table public.music_acts
  add column if not exists extra_bank_accounts jsonb not null default '[]'::jsonb;
