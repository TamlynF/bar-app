-- Venue editor - architectural features (doors, windows, permanent benches).
--
-- Distinct from `fixtures` (AV/service items) and `obstacles` (no-go zones):
-- features are wall/seating elements the user places on the plan.
--
-- features: [{
--   id, kind: 'door'|'window'|'bench', label,
--   x, y, width, length,            -- top-left bounding box (m)
--   facing,                          -- degrees 0-359 (door swing / bench facing); null for windows
--   seats                            -- bench only: number of seats it provides
-- }]
--
-- Obstacles now also support a 'circle' shape (round pillars) in addition to the
-- existing 'rect' and 'polygon'. No DB change needed - `obstacles` is freeform
-- jsonb - this is captured in the app-level types.
alter table public.company_information
  add column if not exists features jsonb not null default '[]'::jsonb;
