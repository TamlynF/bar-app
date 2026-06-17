-- Link private_hire_requests to a private event subtype.
--
-- The public enquiry form now offers the private event subtypes (event_subtypes
-- with behavior = 'private' under the event type named 'private'), labelled by
-- their default_event_title (falling back to name), instead of a free-text reason.
-- The chosen subtype is stored here as a foreign key.
--
-- The "must be a private-behaviour subtype under the private type" rule is enforced
-- in the app (the form only lists those); the column is a plain nullable FK so
-- legacy rows (created before this column existed) keep working.

alter table public.private_hire_requests
  add column if not exists event_subtypes_id integer;

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_event_subtypes_id_fkey;

alter table public.private_hire_requests
  add constraint private_hire_requests_event_subtypes_id_fkey
  foreign key (event_subtypes_id) references public.event_subtypes(id);
