-- Replace the per-subtype boolean kind-flags + hardcoded name discriminators
-- with a single `behavior` column on event_subtypes.
--
-- This mirrors the production change. Capability flags
-- (is_bookable / host_required / seating_required / payment_required on
-- event_subtypes; is_active / is_bookable / is_fully_booked on events) are
-- kept - they are independent, not part of this discriminator.

-- 1. Add (nullable for backfill)
alter table public.event_subtypes add column behavior text;

-- 2. Backfill - precedence quiz > bingo(name) > karaoke > music_act > private > standard
update public.event_subtypes set behavior =
  case
    when is_quiz            then 'quiz'
    when name ilike 'bingo' then 'bingo'
    when is_karaoke         then 'karaoke'
    when is_music_act       then 'music_act'
    when is_private         then 'private'
    else 'standard'
  end;

-- 3. Lock down
alter table public.event_subtypes
  alter column behavior set not null,
  alter column behavior set default 'standard',
  add constraint event_subtypes_behavior_check
    check (behavior in ('standard','quiz','bingo','karaoke','music_act','private'));

-- 5. Drop legacy kind-flags (capability flags kept)
alter table public.event_subtypes
  drop column is_quiz,
  drop column is_karaoke,
  drop column is_private,
  drop column is_music_act;

alter table public.event_types
  drop column is_karaoke,
  drop column is_private,
  drop column is_music_act;
