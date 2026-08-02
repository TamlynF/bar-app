-- Admin-authored notes about a band application become a real list, so each note
-- has its own text, author and timestamp (and the UI can show a genuine count)
-- instead of everything living in the single `band_booking_requests.band_notes`
-- text column.
--
-- `band_notes` is left in place and backfilled from, not dropped: an existing
-- value becomes this request's first note. Drop the column only once nothing
-- reads it.
--
-- NOTE: apply the same schema to the production database.

create table if not exists public.band_booking_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  body       text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by integer,
  updated_by integer
);

-- A note is meaningless without its request, so it goes when the request goes.
-- Authors are audit stamps and merely go null when an employee is removed -
-- matching band_booking_requests.created_by / updated_by.
alter table public.band_booking_notes
  drop constraint if exists band_booking_notes_request_id_fkey;
alter table public.band_booking_notes
  add constraint band_booking_notes_request_id_fkey
  foreign key (request_id) references public.band_booking_requests(id) on delete cascade;

alter table public.band_booking_notes
  drop constraint if exists band_booking_notes_created_by_fkey;
alter table public.band_booking_notes
  add constraint band_booking_notes_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null;

alter table public.band_booking_notes
  drop constraint if exists band_booking_notes_updated_by_fkey;
alter table public.band_booking_notes
  add constraint band_booking_notes_updated_by_fkey
  foreign key (updated_by) references public.employees(id) on delete set null;

-- Every read is "the notes for this request, oldest first".
create index if not exists band_booking_notes_request_id_created_at_idx
  on public.band_booking_notes (request_id, created_at);

-- Backfill: an existing band_notes value becomes the request's first note.
-- Guarded on emptiness so re-running can't duplicate the backfilled rows.
insert into public.band_booking_notes (request_id, body, created_at, updated_at, created_by)
select r.id, btrim(r.band_notes), r.created_at, r.updated_at, r.updated_by
from public.band_booking_requests r
where btrim(coalesce(r.band_notes, '')) <> ''
  and not exists (
    select 1 from public.band_booking_notes n where n.request_id = r.id
  );
