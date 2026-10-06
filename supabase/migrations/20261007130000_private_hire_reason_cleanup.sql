-- The private hire enquiry form picks an event subtype instead of taking a
-- typed reason, so the two free-text reason columns go:
--   * enquiries from before the dropdown get the subtype their text starts
--     with (e.g. "Birthday party" -> birthday), otherwise "other";
--   * wherever the typed text says more than the subtype's name, it is kept
--     at the top of additional_requirements as "Reason given: ...";
--   * event_subtypes_id becomes required.
-- admin_notes only ever held the reason given to the customer when a request
-- was declined or cancelled, so it is renamed to say so.
-- event_subtypes gains show_on_enquiry_form so staff can take a private
-- subtype off the public form without deleting it.

alter table public.event_subtypes
  add column if not exists show_on_enquiry_form boolean not null default true;

update public.private_hire_requests r
set event_subtypes_id = m.subtype_id
from (
  select distinct on (h.id) h.id, s.id as subtype_id
  from public.private_hire_requests h
  join public.event_subtypes s
    on s.behavior = 'private'
   and lower(trim(h.reason_for_hire)) like lower(s.name) || '%'
  where h.event_subtypes_id is null
  order by h.id, length(s.name) desc
) m
where r.id = m.id;

update public.private_hire_requests
set event_subtypes_id = (
  select id from public.event_subtypes
  where behavior = 'private' and lower(name) = 'other'
  order by id
  limit 1
)
where event_subtypes_id is null;

update public.private_hire_requests r
set additional_requirements = concat_ws(
  E'\n\n',
  'Reason given: ' || trim(r.reason_for_hire),
  nullif(trim(r.additional_requirements), '')
)
from public.event_subtypes s
where s.id = r.event_subtypes_id
  and coalesce(trim(r.reason_for_hire), '') <> ''
  and lower(trim(r.reason_for_hire)) <> lower(s.name)
  and lower(trim(r.reason_for_hire)) <> lower(coalesce(s.default_event_title, ''));

alter table public.private_hire_requests
  alter column event_subtypes_id set not null;

alter table public.private_hire_requests
  drop column if exists reason_for_hire,
  drop column if exists reason;

alter table public.private_hire_requests
  rename column admin_notes to decline_reason;
