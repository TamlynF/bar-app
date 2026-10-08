-- Every picture of an act in one table: uploads from the public form and the
-- admin sheets, the Spotify artist picture, Instagram / Messenger profile
-- pictures and images taken from correspondence. The act and the booking
-- request each point at one row as their poster; un-pointing never deletes
-- the row or the file.
--
-- music_acts.cover_image_url and image_urls are folded into this table and
-- dropped. No RLS, matching music_acts: the public band form inserts rows
-- through the anon role.

create table if not exists public.music_act_images (
  id uuid primary key default gen_random_uuid(),
  music_acts_id uuid not null references public.music_acts(id) on delete cascade,
  band_booking_request_id uuid references public.band_booking_requests(id) on delete set null,
  url text not null,
  storage_path text,
  source text not null default 'upload'
    check (source in ('upload', 'instagram', 'messenger', 'spotify', 'correspondence', 'migrated')),
  email_message_id uuid references public.email_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by integer references public.employees(id) on delete set null
);

create index if not exists music_act_images_act_idx
  on public.music_act_images (music_acts_id, created_at desc);
create index if not exists music_act_images_request_idx
  on public.music_act_images (band_booking_request_id);

alter table public.music_acts
  add column if not exists cover_image_id uuid references public.music_act_images(id) on delete set null;

alter table public.band_booking_requests
  add column if not exists cover_image_id uuid references public.music_act_images(id) on delete set null;

alter table public.contact_channels
  add column if not exists profile_pic_url text;

-- Backfill: the old cover becomes the act's poster row, the old gallery
-- becomes plain rows, and every booked request inherits the act's poster.
with covers as (
  insert into public.music_act_images (music_acts_id, url, source, created_at)
  select id, cover_image_url, 'migrated', created_at
  from public.music_acts
  where coalesce(trim(cover_image_url), '') <> ''
  returning id, music_acts_id
)
update public.music_acts a
set cover_image_id = c.id
from covers c
where c.music_acts_id = a.id;

insert into public.music_act_images (music_acts_id, url, source, created_at)
select a.id, u, 'migrated', a.created_at
from public.music_acts a
cross join lateral unnest(a.image_urls) as u
where coalesce(trim(u), '') <> ''
  and u is distinct from a.cover_image_url;

update public.band_booking_requests r
set cover_image_id = a.cover_image_id
from public.music_acts a
where r.music_acts_id = a.id
  and a.cover_image_id is not null
  and r.cover_image_id is null
  and r.status = 'booked';

alter table public.music_acts
  drop column if exists cover_image_url,
  drop column if exists image_urls;

-- Public bucket for act pictures. Anonymous upload so the band form can
-- attach a poster; listing stays staff-only like band-videos.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'act-images',
      'act-images',
      true,
      10485760,
      array['image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do nothing;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'act-images staff read'
    ) then
      create policy "act-images staff read" on storage.objects
        for select to authenticated using (bucket_id = 'act-images');
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'act-images upload'
    ) then
      create policy "act-images upload" on storage.objects
        for insert to anon, authenticated with check (bucket_id = 'act-images');
    end if;
  end if;
end $$;
