-- Internal staff notes on a music act become a list, one row per note with its
-- own author and timestamp - the same shape as band_booking_notes and
-- private_hire_notes, so every sheet shares one notes card.
--
-- music_acts.internal_notes is left in place and backfilled from, not dropped:
-- an existing value becomes the act's first note. Drop the column only once
-- nothing reads it.

create table if not exists public.music_act_notes (
  id         uuid primary key default gen_random_uuid(),
  act_id     uuid not null,
  body       text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by integer,
  updated_by integer
);

alter table public.music_act_notes
  drop constraint if exists music_act_notes_act_id_fkey;
alter table public.music_act_notes
  add constraint music_act_notes_act_id_fkey
  foreign key (act_id) references public.music_acts(id) on delete cascade;

alter table public.music_act_notes
  drop constraint if exists music_act_notes_created_by_fkey;
alter table public.music_act_notes
  add constraint music_act_notes_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null;

alter table public.music_act_notes
  drop constraint if exists music_act_notes_updated_by_fkey;
alter table public.music_act_notes
  add constraint music_act_notes_updated_by_fkey
  foreign key (updated_by) references public.employees(id) on delete set null;

create index if not exists music_act_notes_act_id_created_at_idx
  on public.music_act_notes (act_id, created_at);

alter table public.music_act_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'music_act_notes'
      and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.music_act_notes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Guarded on emptiness so re-running can't duplicate the backfilled rows.
insert into public.music_act_notes (act_id, body, created_at, updated_at, created_by)
select a.id, btrim(a.internal_notes), a.updated_at, a.updated_at, a.updated_by
from public.music_acts a
where btrim(coalesce(a.internal_notes, '')) <> ''
  and not exists (
    select 1 from public.music_act_notes n where n.act_id = a.id
  );
