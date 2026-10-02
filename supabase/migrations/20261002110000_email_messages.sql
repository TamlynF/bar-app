-- Email correspondence with music acts. Every email sent to a band is logged
-- here, and replies arrive through the Resend inbound webhook
-- (/api/resend/inbound) and land in the same table, so a band request and its
-- music act both show the whole conversation.
--
-- band_booking_request_id is set when the email belongs to one request; an
-- email sent from the music act page carries only music_act_id. Bodies are
-- stored as plain text for display - inbound HTML is never rendered - with the
-- original HTML kept for reference.

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  band_booking_request_id uuid references public.band_booking_requests(id) on delete set null,
  music_act_id uuid references public.music_acts(id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  kind text,
  from_address text not null,
  to_addresses text[] not null default '{}'::text[],
  subject text not null default '',
  text_body text not null default '',
  html_body text,
  resend_email_id text,
  message_id text,
  in_reply_to text,
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  sent_by integer references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists email_messages_request_idx
  on public.email_messages (band_booking_request_id, created_at);
create index if not exists email_messages_music_act_idx
  on public.email_messages (music_act_id, created_at);
create index if not exists email_messages_message_id_idx
  on public.email_messages (message_id);
create unique index if not exists email_messages_resend_inbound_idx
  on public.email_messages (resend_email_id)
  where direction = 'inbound';
create index if not exists email_messages_unread_idx
  on public.email_messages (band_booking_request_id, music_act_id)
  where direction = 'inbound' and read_at is null;

alter table public.email_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_messages'
      and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.email_messages
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Private bucket: attachments a band sends (contracts, riders) are internal
-- paperwork, served to staff through short-lived signed URLs. Files are written
-- by the inbound webhook with the service role.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('email-attachments', 'email-attachments', false)
    on conflict (id) do nothing;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'Email attachments readable by authenticated'
    ) then
      create policy "Email attachments readable by authenticated" on storage.objects
        for select to authenticated using (bucket_id = 'email-attachments');
    end if;
  end if;
end $$;
