-- Additive follow-up to 20260707130000_marketing_trends.
--
-- The `action` and `effort` fields were added after the base migration had already
-- been applied to the hosted project, so they ship as their own migration to reach
-- databases where the table already exists. Idempotent + safe to re-run.

alter table public.marketing_trends
  add column if not exists action text,   -- concrete "do this this week" suggestion
  add column if not exists effort text;   -- 'Easy' | 'Medium' | 'Big'

alter table public.marketing_trends
  drop constraint if exists marketing_trends_effort_check;
alter table public.marketing_trends
  add constraint marketing_trends_effort_check
  check (effort is null or effort in ('Easy', 'Medium', 'Big'));

grant all on public.marketing_trends to anon, authenticated, service_role;

-- Ask PostgREST to refresh its schema cache so the new columns are queryable
-- immediately (otherwise inserts referencing them fail with PGRST204).
notify pgrst, 'reload schema';
