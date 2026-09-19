alter table public.marketing_settings
  add column if not exists last_rival_run jsonb;

alter table public.marketing_competitors
  add column if not exists last_capture_error text,
  add column if not exists last_capture_attempted_at timestamptz;
