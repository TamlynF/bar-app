-- A user created before their first day is "pending": on the books, not yet
-- started. The check constraint would reject the value without this.
alter table public.employees drop constraint if exists employees_status_check;

alter table public.employees add constraint employees_status_check
  check (status = any (array['active'::text, 'inactive'::text, 'leave'::text, 'pending'::text]));
