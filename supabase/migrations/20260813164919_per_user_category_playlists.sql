/* A round's Spotify playlist used to be a single shared row, so only the person
   whose account created it could ever sync it. Each employee now gets their own
   row for the same round.

   Purely additive: no row is read, rewritten or removed. Rows that predate this
   keep employee_id null, which means "made before per-user playlists" - they stay
   visible to everyone and are claimed by whoever first syncs one they own. */

alter table public.event_category_playlists
  add column if not exists employee_id bigint
  references public.employees(id) on delete cascade;

alter table public.event_category_playlists
  drop constraint if exists event_category_playlists_events_id_quiz_category_configs_id_key;

/* NULLS NOT DISTINCT keeps the old guarantee for the legacy rows - at most one
   employee-less playlist per round - while giving every employee their own. */
alter table public.event_category_playlists
  drop constraint if exists event_category_playlists_event_cat_employee_key;

alter table public.event_category_playlists
  add constraint event_category_playlists_event_cat_employee_key
  unique nulls not distinct (events_id, quiz_category_configs_id, employee_id);

create index if not exists event_category_playlists_employee_idx
  on public.event_category_playlists (employee_id);
