-- Relocate booking-page/form config to the level that owns the public booking page.
--   per_type    → event_types.booking_config (new, shared across the whole category)
--   per_subtype → event_subtypes.booking_config (renamed from default_booking_config)
--   per_event   → events.booking_config (unchanged)

-- Rename the subtype default config to a plain booking_config.
alter table public.event_subtypes
  rename column default_booking_config to booking_config;

-- Give event_types their own bookable flag + shared booking config (per_type owner).
alter table public.event_types
  add column if not exists is_bookable boolean not null default false,
  add column if not exists booking_config jsonb not null default '{}'::jsonb;
