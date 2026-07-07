-- Additive follow-up to 20260707130000_marketing_trends.
--
-- Adds a third trend kind, 'price', for AI price-positioning idea cards surfaced
-- from the Prices tab's "Live AI: local price insights" button. Idempotent.

alter table public.marketing_trends
  drop constraint if exists marketing_trends_kind_check;
alter table public.marketing_trends
  add constraint marketing_trends_kind_check
  check (kind in ('advertising', 'event_idea', 'price'));

notify pgrst, 'reload schema';
