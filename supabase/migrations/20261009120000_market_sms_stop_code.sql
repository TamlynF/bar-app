-- Short code for the "stop texts" link in every alert. An alphanumeric
-- sender can't receive STOP replies, so the text itself carries the way
-- out; twelve hex characters keep the link inside the 160-character budget.
alter table public.market_sms_subscriptions
  add column if not exists stop_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
