-- The other end of the same story: when this person first dealt with the venue.
-- Set by the same triggers, taking the earliest rather than the latest.
alter table public.contacts add column if not exists first_interaction_date timestamp with time zone;

create index if not exists contacts_first_interaction_idx
  on public.contacts (first_interaction_date);

create or replace function public.touch_contact_interaction_by_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
     set first_interaction_date = least(coalesce(first_interaction_date, new.created_at), new.created_at),
         last_interaction_date = greatest(coalesce(last_interaction_date, new.created_at), new.created_at)
   where id = new.contact_id;
  return new;
end;
$$;

create or replace function public.touch_contact_interaction_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
     set first_interaction_date = least(coalesce(first_interaction_date, new.created_at), new.created_at),
         last_interaction_date = greatest(coalesce(last_interaction_date, new.created_at), new.created_at)
   where (new.contact_id is not null and id = new.contact_id)
      or (new.contact_id is null and lower(email) = lower(new.email));
  return new;
end;
$$;

with activity as (
  select b.contact_id as contact_id, min(b.created_at) as first_at, max(b.created_at) as last_at
    from public.bookings b
   where b.contact_id is not null
   group by b.contact_id
  union all
  select coalesce(r.contact_id, c.id), min(r.created_at), max(r.created_at)
    from public.band_booking_requests r
    left join public.contacts c on lower(c.email) = lower(r.email)
   where coalesce(r.contact_id, c.id) is not null
   group by coalesce(r.contact_id, c.id)
  union all
  select coalesce(p.contact_id, c.id), min(p.created_at), max(p.created_at)
    from public.private_hire_requests p
    left join public.contacts c on lower(c.email) = lower(p.email)
   where coalesce(p.contact_id, c.id) is not null
   group by coalesce(p.contact_id, c.id)
),
spans as (
  select contact_id, min(first_at) as first_at, max(last_at) as last_at
    from activity
   group by contact_id
)
update public.contacts c
   set first_interaction_date = spans.first_at,
       last_interaction_date = spans.last_at
  from spans
 where c.id = spans.contact_id;
