-- Internal staff notes on a private hire enquiry, one row per note with its own
-- author and timestamp - the same shape as band_booking_notes, so both request
-- sheets share one notes card.

create table if not exists public.private_hire_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  body       text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by integer,
  updated_by integer
);

-- A note is meaningless without its request, so it goes when the request goes.
-- Authors are audit stamps and merely go null when an employee is removed.
alter table public.private_hire_notes
  drop constraint if exists private_hire_notes_request_id_fkey;
alter table public.private_hire_notes
  add constraint private_hire_notes_request_id_fkey
  foreign key (request_id) references public.private_hire_requests(id) on delete cascade;

alter table public.private_hire_notes
  drop constraint if exists private_hire_notes_created_by_fkey;
alter table public.private_hire_notes
  add constraint private_hire_notes_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null;

alter table public.private_hire_notes
  drop constraint if exists private_hire_notes_updated_by_fkey;
alter table public.private_hire_notes
  add constraint private_hire_notes_updated_by_fkey
  foreign key (updated_by) references public.employees(id) on delete set null;

create index if not exists private_hire_notes_request_id_created_at_idx
  on public.private_hire_notes (request_id, created_at);

alter table public.private_hire_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_hire_notes'
      and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.private_hire_notes
      for all to authenticated using (true) with check (true);
  end if;
end $$;
