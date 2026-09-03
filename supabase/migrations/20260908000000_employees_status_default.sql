-- The default had been re-quoted through repeated alters and resolved to the
-- literal string '''pending''::text'::text, which fails employees_status_check.
alter table public.employees
  alter column status set default 'pending';
