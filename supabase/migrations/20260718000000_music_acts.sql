-- Music Acts master file: one canonical record per band/artist, populated
-- automatically when a band request is submitted and manageable from the admin
-- Settings › Music Acts page. Bands used to be re-entered inline on every
-- band_booking_requests row; this table gives them a single shared profile
-- (socials, videos, images, bank details, contact link).
--
-- uuid PK to match its sibling public-origin tables (band_booking_requests,
-- enquiries). Audit columns follow the band_booking_requests convention
-- (integer → employees(id) on delete set null); updated_at is maintained in
-- application code, not by a trigger.
--
-- NOTE: apply the same schema to the production database.

create table if not exists public.music_acts (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  type text,
  genre text,
  introduction text,
  spotify_url text,
  cover_image_url text,
  image_urls text[] not null default '{}'::text[],
  social_links jsonb not null default '{}'::jsonb,
  video_urls text[] not null default '{}'::text[],
  video_descriptions text[] not null default '{}'::text[],
  web_url text,
  contact_id bigint references public.contacts(id) on delete set null,
  bank_account_no text,
  bank_account_name text,
  bank_sort_code text,
  bank_payment_ref text,
  internal_notes text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by integer references public.employees(id) on delete set null,
  created_by integer references public.employees(id) on delete set null
);

create index if not exists music_acts_group_name_idx on public.music_acts (lower(group_name));
create index if not exists music_acts_contact_id_idx on public.music_acts (contact_id);

-- Link each band request to its master act, and carry a Spotify URL on the
-- request itself (also collected on the public form).
alter table public.band_booking_requests
  add column if not exists music_acts_id uuid references public.music_acts(id) on delete set null,
  add column if not exists spotify_url text;

create index if not exists band_booking_requests_music_acts_id_idx
  on public.band_booking_requests (music_acts_id);
