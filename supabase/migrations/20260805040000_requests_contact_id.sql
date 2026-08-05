-- Band and private-hire requests came in from the public site with only an email
-- address tying them to a person, so a booker who used a second address looked
-- like a stranger. They now carry the contact id outright; the email stays as
-- the fallback for rows created before this.
alter table public.band_booking_requests
  add column if not exists contact_id bigint references public.contacts(id) on delete set null;

alter table public.private_hire_requests
  add column if not exists contact_id bigint references public.contacts(id) on delete set null;

create index if not exists band_booking_requests_contact_idx
  on public.band_booking_requests (contact_id);

create index if not exists private_hire_requests_contact_idx
  on public.private_hire_requests (contact_id);

update public.band_booking_requests r
   set contact_id = c.id
  from public.contacts c
 where r.contact_id is null
   and lower(c.email) = lower(r.email);

update public.private_hire_requests p
   set contact_id = c.id
  from public.contacts c
 where p.contact_id is null
   and lower(c.email) = lower(p.email);

-- With a real link on the row, the trigger no longer has to guess from the
-- address. It still falls back to email so a row inserted without the id set is
-- not silently missed.
create or replace function public.touch_contact_interaction_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
     set last_interaction_date = greatest(coalesce(last_interaction_date, new.created_at), new.created_at)
   where (new.contact_id is not null and id = new.contact_id)
      or (new.contact_id is null and lower(email) = lower(new.email));
  return new;
end;
$$;
