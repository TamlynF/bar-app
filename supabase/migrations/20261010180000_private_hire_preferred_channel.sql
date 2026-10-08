-- Private hire enquiries get the same source and preferred-channel tracking
-- as band applications. The enquiry form has no social links, so an
-- Instagram handle is kept on the row for a customer who wants Instagram
-- replies; it is what an inbound DM from them is matched on.

alter table public.private_hire_requests
  add column if not exists source_channel text,
  add column if not exists preferred_channel text not null default 'email',
  add column if not exists source_channel_id uuid references public.contact_channels(id) on delete set null,
  add column if not exists instagram_handle text;

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_source_channel_check;
alter table public.private_hire_requests
  add constraint private_hire_requests_source_channel_check
  check (source_channel is null or source_channel in ('email', 'instagram', 'messenger', 'sms', 'whatsapp'));

alter table public.private_hire_requests
  drop constraint if exists private_hire_requests_preferred_channel_check;
alter table public.private_hire_requests
  add constraint private_hire_requests_preferred_channel_check
  check (preferred_channel in ('email', 'instagram', 'messenger'));
