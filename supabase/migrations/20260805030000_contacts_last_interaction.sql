-- When this person last did anything with the venue: took a booking, applied to
-- play, or asked about a private hire. Kept current by triggers rather than by
-- the app, so a record created from any route still counts.
alter table public.contacts add column if not exists last_interaction_date timestamp with time zone;

create index if not exists contacts_last_interaction_idx
  on public.contacts (last_interaction_date desc nulls last);

-- Bookings carry the contact id. Never moves backwards, so a back-dated row
-- cannot undo a more recent one.
create or replace function public.touch_contact_interaction_by_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
     set last_interaction_date = greatest(coalesce(last_interaction_date, new.created_at), new.created_at)
   where id = new.contact_id;
  return new;
end;
$$;

-- Band and private-hire requests are taken from the public site with no account,
-- so the email address is the only link back to a contact.
create or replace function public.touch_contact_interaction_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
     set last_interaction_date = greatest(coalesce(last_interaction_date, new.created_at), new.created_at)
   where lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists bookings_touch_contact on public.bookings;
create trigger bookings_touch_contact
after insert on public.bookings
for each row execute function public.touch_contact_interaction_by_id();

drop trigger if exists band_requests_touch_contact on public.band_booking_requests;
create trigger band_requests_touch_contact
after insert on public.band_booking_requests
for each row execute function public.touch_contact_interaction_by_email();

drop trigger if exists private_hire_touch_contact on public.private_hire_requests;
create trigger private_hire_touch_contact
after insert on public.private_hire_requests
for each row execute function public.touch_contact_interaction_by_email();

-- Seed from everything already on record.
with activity as (
  select b.contact_id as contact_id, max(b.created_at) as last_at
    from public.bookings b
   where b.contact_id is not null
   group by b.contact_id
  union all
  select c.id, max(r.created_at)
    from public.band_booking_requests r
    join public.contacts c on lower(c.email) = lower(r.email)
   group by c.id
  union all
  select c.id, max(p.created_at)
    from public.private_hire_requests p
    join public.contacts c on lower(c.email) = lower(p.email)
   group by c.id
),
latest as (
  select contact_id, max(last_at) as last_at from activity group by contact_id
)
update public.contacts c
   set last_interaction_date = latest.last_at
  from latest
 where c.id = latest.contact_id;
