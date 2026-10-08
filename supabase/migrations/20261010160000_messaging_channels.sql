-- Messenger and Instagram DMs join the email correspondence. Every message now
-- says which channel it travelled on, and a contact can carry the Meta ids
-- (Page-scoped for Messenger, Instagram-scoped for Instagram) that let staff
-- reply on the same channel - plus when they last wrote, since Meta only
-- allows a reply inside a window after the customer's last message.

alter table public.email_messages
  add column if not exists channel text not null default 'email',
  add column if not exists external_id text,
  add column if not exists sender_name text;

alter table public.email_messages
  drop constraint if exists email_messages_channel_check;
alter table public.email_messages
  add constraint email_messages_channel_check
  check (channel in ('email', 'messenger', 'instagram'));

create unique index if not exists email_messages_channel_external_idx
  on public.email_messages (channel, external_id)
  where external_id is not null;

create table if not exists public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id bigint not null references public.contacts(id) on delete cascade,
  channel text not null check (channel in ('messenger', 'instagram')),
  external_id text not null,
  handle text,
  display_name text,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists contact_channels_contact_idx
  on public.contact_channels (contact_id);

alter table public.contact_channels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_channels'
      and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.contact_channels
      for all to authenticated using (true) with check (true);
  end if;
end $$;
