-- Settings → Email templates could not save: row level security is on for
-- email_templates in production, but its only policy lets anon read. Signed-in
-- staff run as `authenticated`, so their upserts were refused - and their reads
-- came back empty, which silently fell every email back to the built-in copy.
--
-- Staff get full access, the same as the other staff-managed tables. The anon
-- read policy stays: public booking flows render these templates too.

alter table public.email_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_templates'
      and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.email_templates
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_templates'
      and policyname = 'Allow anon read'
  ) then
    create policy "Allow anon read" on public.email_templates
      for select to anon using (true);
  end if;
end $$;
