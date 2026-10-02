-- Enquiries and customers join the email correspondence.
--
-- enquiry_id links an email to a contact-form enquiry (reply-to enq-<ref>@).
-- contact_id links every email to the customer it was with, whatever it was
-- about, so a customer's record shows one thread across their band requests,
-- private hires, enquiries and direct emails (reply-to cust-<id>@).

alter table public.email_messages
  add column if not exists enquiry_id uuid
    references public.enquiries(id) on delete set null;

alter table public.email_messages
  add column if not exists contact_id bigint
    references public.contacts(id) on delete set null;

create index if not exists email_messages_enquiry_idx
  on public.email_messages (enquiry_id, created_at);
create index if not exists email_messages_contact_idx
  on public.email_messages (contact_id, created_at);
create index if not exists email_messages_enquiry_unread_idx
  on public.email_messages (enquiry_id)
  where direction = 'inbound' and read_at is null;
create index if not exists email_messages_contact_unread_idx
  on public.email_messages (contact_id)
  where direction = 'inbound' and read_at is null;

-- Emails logged before this column existed: take the customer from the request
-- they belong to, then fall back to the other party's address.
update public.email_messages m
set contact_id = b.contact_id
from public.band_booking_requests b
where m.contact_id is null and m.band_booking_request_id = b.id and b.contact_id is not null;

update public.email_messages m
set contact_id = p.contact_id
from public.private_hire_requests p
where m.contact_id is null and m.private_hire_request_id = p.id and p.contact_id is not null;

update public.email_messages m
set contact_id = a.contact_id
from public.music_acts a
where m.contact_id is null and m.music_act_id = a.id and a.contact_id is not null;

update public.email_messages m
set contact_id = (
  select c.id
  from public.contacts c
  where lower(c.email) = lower(trim(
    case
      when m.direction = 'outbound' then m.to_addresses[1]
      else coalesce(substring(m.from_address from '<([^>]+)>'), m.from_address)
    end
  ))
  order by c.id
  limit 1
)
where m.contact_id is null;
