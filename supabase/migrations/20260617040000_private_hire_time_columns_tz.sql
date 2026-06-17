-- Change private_hire_requests time columns from `time without time zone` to
-- `time with time zone` (timetz): preferred_start_time, preferred_end_time,
-- selected_start_time and selected_end_time.
--
-- The `::time with time zone` cast attaches the session's UTC offset to each
-- existing value. We pin the session to UTC first so stored times become +00
-- rather than depending on the server's local timezone at migration time.

set local time zone 'UTC';

alter table public.private_hire_requests
  alter column preferred_start_time type time with time zone
  using preferred_start_time::time with time zone,
  alter column preferred_end_time type time with time zone
  using preferred_end_time::time with time zone,
  alter column selected_start_time type time with time zone
  using selected_start_time::time with time zone,
  alter column selected_end_time type time with time zone
  using selected_end_time::time with time zone;
