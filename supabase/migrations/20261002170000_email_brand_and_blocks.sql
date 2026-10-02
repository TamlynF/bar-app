-- Staff can now restyle the automatic emails, not just reword them.
--
-- email_brand is one shared row: logo, font, header colours, button colour and
-- footer line. Every column is nullable and null means "keep that email
-- design's own look", so the three designs (band, booking card, plain) stay as
-- they are until someone deliberately changes something.
--
-- email_templates.blocks holds a template's body as an ordered list of blocks
-- (text, image, button, divider, spacer, plus the generated booking blocks such
-- as the proposed-slot card). Null keeps the standard layout, so every existing
-- template renders exactly as before.
--
-- email-assets is a public bucket for logos and images placed in emails - mail
-- clients fetch them over the open web, so they cannot sit behind auth. Uploads
-- go through a server action with the service role.

create table if not exists public.email_brand (
  id smallint primary key default 1 check (id = 1),
  logo_url text,
  logo_width integer,
  font text,
  header_bg text,
  header_text text,
  accent text,
  footer_text text,
  updated_at timestamp with time zone not null default now(),
  updated_by integer references public.employees(id) on delete set null
);

alter table public.email_brand enable row level security;

alter table public.email_templates add column if not exists blocks jsonb;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_brand' and policyname = 'Allow authenticated full'
  ) then
    create policy "Allow authenticated full" on public.email_brand
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_brand' and policyname = 'Allow anon read'
  ) then
    create policy "Allow anon read" on public.email_brand
      for select to anon using (true);
  end if;
end $$;

grant all on public.email_brand to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'email-assets',
      'email-assets',
      true,
      5242880,
      array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    )
    on conflict (id) do nothing;
  end if;
end $$;
