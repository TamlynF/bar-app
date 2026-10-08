-- Where an application came from and how the act wants to be contacted.
-- The booking link staff send on a chat carries ?via=<channel>&c=<contact_channels.id>,
-- so the form knows the channel and handle before the act types anything;
-- contact_channels rows can now exist before a contact does (an act who DMs
-- first and applies later), and each stored chat message keeps the sender id
-- so those early messages can be pulled onto the application once it exists.

alter table public.contact_channels
  alter column contact_id drop not null;

alter table public.email_messages
  add column if not exists sender_id text;

create index if not exists email_messages_channel_sender_idx
  on public.email_messages (channel, sender_id)
  where sender_id is not null;

alter table public.band_booking_requests
  add column if not exists source_channel text,
  add column if not exists preferred_channel text not null default 'email',
  add column if not exists source_channel_id uuid references public.contact_channels(id) on delete set null;

alter table public.band_booking_requests
  drop constraint if exists band_booking_requests_source_channel_check;
alter table public.band_booking_requests
  add constraint band_booking_requests_source_channel_check
  check (source_channel is null or source_channel in ('email', 'instagram', 'messenger', 'sms', 'whatsapp'));

alter table public.band_booking_requests
  drop constraint if exists band_booking_requests_preferred_channel_check;
alter table public.band_booking_requests
  add constraint band_booking_requests_preferred_channel_check
  check (preferred_channel in ('email', 'instagram', 'messenger'));
