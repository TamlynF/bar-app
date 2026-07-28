-- Where an event row came from. creation_source_id holds an events.id (as text)
-- for copies, or the originating request uuid for band / private hire placements.
alter table public.events add column if not exists creation_method text not null default 'manual';
alter table public.events add column if not exists creation_source_id text;

alter table public.events drop constraint if exists events_creation_method_check;
alter table public.events add constraint events_creation_method_check
  check (creation_method in ('manual', 'copy', 'band_request', 'private_hire_request'));

update public.events e
set creation_method = 'band_request', creation_source_id = b.id::text
from public.band_booking_requests b
where b.event_id = e.id;

update public.events e
set creation_method = 'private_hire_request', creation_source_id = p.id::text
from public.private_hire_requests p
where p.event_id = e.id;
