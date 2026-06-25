-- Allow event-level table placements that aren't tied to a specific booking.
-- The floor-plan calculator can add "available" tables directly to an event's
-- layout (no booking); those mappings carry an event_id but a null booking_id.
alter table public.booking_table_mappings
  alter column booking_id drop not null;
