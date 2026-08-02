-- Per-table chair arrangement for the floor-plan calculator.
--
-- chair_layout: null (auto - distribute around the table) OR
--   { mode: 'sides' | 'bench', perSide: number, ends?: number }
--   - 'sides' → `perSide` chairs on each long side + `ends` chairs on each short end
--   - 'bench' → a bench seating `perSide` along each long side
alter table public.tables
  add column if not exists chair_layout jsonb;
