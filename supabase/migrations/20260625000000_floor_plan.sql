-- Floor Plan Layout Calculator - Phase 1 schema.
--
-- Adds venue geometry (configured once, reused per event), per-table geometry,
-- an event_id on table mappings (source of truth for which tables an event uses),
-- and a saved layout blob on events. All changes are additive.
--
-- Coordinate convention for every geometry JSONB below: metres, origin top-left,
-- +x right / +y down. Facing is degrees 0-359.

-- ── 1. company_information - venue geometry ──────────────────────────────────
-- room_outline: { points: [{x,y}, ...], width, length } | null
-- obstacles:    [{ id, label, shape:'rect'|'polygon', x, y, width, length, points? }]
-- fixtures:     [{ id, type:'stage'|'bar'|'dj_booth'|'projector'|'tv', label,
--                  x, y, width, length, facing }]
alter table public.company_information
  add column if not exists room_outline jsonb,
  add column if not exists obstacles    jsonb not null default '[]'::jsonb,
  add column if not exists fixtures     jsonb not null default '[]'::jsonb;

-- ── 2. tables - table geometry (metres) ──────────────────────────────────────
alter table public.tables
  add column if not exists shape    text not null default 'round',
  add column if not exists diameter numeric,        -- round tables
  add column if not exists width    numeric,        -- rect tables
  add column if not exists length   numeric;        -- rect tables

alter table public.tables
  drop constraint if exists tables_shape_check;
alter table public.tables
  add constraint tables_shape_check check (shape in ('round', 'rect'));

-- ── 3. booking_table_mappings - event_id ─────────────────────────────────────
alter table public.booking_table_mappings
  add column if not exists event_id bigint;

-- Backfill from the linked booking before wiring up the FK.
update public.booking_table_mappings m
set event_id = b.event_id
from public.bookings b
where m.booking_id = b.id and m.event_id is null;

alter table public.booking_table_mappings
  drop constraint if exists booking_table_mappings_event_id_fkey;
alter table public.booking_table_mappings
  add constraint booking_table_mappings_event_id_fkey
  foreign key (event_id) references public.events(id)
  on update cascade on delete cascade;

create index if not exists booking_table_mappings_event_id_idx
  on public.booking_table_mappings (event_id);

-- Clean up mappings when their booking is deleted too (existing FK only cascaded
-- on update). Recreate it with on delete cascade.
alter table public.booking_table_mappings
  drop constraint if exists booking_table_mappings_booking_id_fkey;
alter table public.booking_table_mappings
  add constraint booking_table_mappings_booking_id_fkey
  foreign key (booking_id) references public.bookings(id)
  on update cascade on delete cascade;

-- ── 4. events - saved floor plan layout ──────────────────────────────────────
-- floor_plan_layout: {
--   version, savedAt,
--   settings: { chairZone, aisleWidth, mustSee: [focalId, ...] },
--   tables:   [{ tableId, x, y, rotation, baseSeats, extraChairs, sightlines:{} }],
--   stats:    { tablesPlaced, tablesAvailable, totalSeats, utilisation,
--               mustSeeCompliant, warnings: [] }
-- } | null
alter table public.events
  add column if not exists floor_plan_layout jsonb;
