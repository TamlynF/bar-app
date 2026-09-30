-- 20260919183000 and 20260919200000 change marketing_competitors, but their
-- versions sort before the table is created (20260922000000), so on a fresh
-- database they run first and cannot. They now skip when the table is missing,
-- and their changes run again here, after the table exists and 20260922120000
-- has copied menu_url into menu_urls. Production already has all of this, so
-- every statement below is a no-op there.

alter table if exists public.marketing_competitors
  add column if not exists last_capture_error text,
  add column if not exists last_capture_attempted_at timestamptz;

alter table if exists public.marketing_competitors
  drop column if exists menu_url;
