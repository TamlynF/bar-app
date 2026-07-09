-- General enquiries — the in-app replacement for Instagram DM questions.
-- Workflow: pending (amber, needs a reply) → responded (green, reply emailed)
-- → closed (stone, no further action).

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone_no text,
  subject text,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'responded', 'closed')),
  reply_message text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by bigint references public.employees(id)
);

create index enquiries_status_idx on public.enquiries (status);
create index enquiries_created_at_idx on public.enquiries (created_at desc);

-- RLS: anonymous visitors may submit; only signed-in staff may read/manage.
-- If your other public-submission tables (e.g. private hire) don't use RLS,
-- drop this section to stay consistent with the existing convention.
alter table public.enquiries enable row level security;

create policy "Anyone can submit an enquiry"
  on public.enquiries for insert
  to anon, authenticated
  with check (true);

create policy "Staff can read enquiries"
  on public.enquiries for select
  to authenticated
  using (true);

create policy "Staff can update enquiries"
  on public.enquiries for update
  to authenticated
  using (true);