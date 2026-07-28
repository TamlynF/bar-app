-- Production carries a lookup index on events.event_subtypes_id that the local
-- test schema never had (it post-dates the introspected base migration). Added
-- here so `supabase db reset` reproduces prod's index set exactly.
create index if not exists events_event_subtypes_id_idx
  on public.events using btree (event_subtypes_id);
