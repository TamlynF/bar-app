-- Hard guarantee against two bookings grabbing the same table for one event.
--
-- A table may be held at most once per event by a *booking* mapping
-- (booking_id IS NOT NULL). Event-level floor-plan placement rows
-- (booking_id IS NULL) are intentionally excluded from the constraint - an
-- event can place a table on its layout without it counting as "occupied".
--
-- The table-allocation orchestrators re-check availability before inserting,
-- but this partial unique index is the authoritative backstop: a lost race
-- surfaces as a 23505 unique-violation, which the loser handles by waitlisting.
create unique index if not exists booking_table_mappings_event_table_uq
  on public.booking_table_mappings (event_id, table_id)
  where booking_id is not null;
