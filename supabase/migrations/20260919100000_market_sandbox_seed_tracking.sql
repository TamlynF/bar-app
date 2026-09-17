-- Seeding the sandbox catalog used to create a fresh ITEM every run, because
-- batchUpsert treats a "#"-prefixed id as "make a new object". Recording the
-- catalog item each instrument created lets a re-seed delete its own previous
-- objects instead of leaving a duplicate behind. Null means the instrument is
-- pointed at a catalog object the seeder did not create (a real menu mapping),
-- which must never be deleted.

alter table public.market_instruments
  add column if not exists sandbox_item_id text;
