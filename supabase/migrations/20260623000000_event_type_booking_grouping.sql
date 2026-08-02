-- How an event category presents its bookable events on the public /book hub:
--   'per_event'   - one card per event (the historical behaviour), each linking
--                   to /book/event/[id].
--   'per_subtype' - events collapsed by sub-type into a single card/page per
--                   sub-type, with a date dropdown (/book/group/subtype/[id]).
--   'per_type'    - all the category's events collapsed into one card/page, with
--                   a date dropdown (/book/group/type/[id]).
-- Only affects the generic "Upcoming Events" list; the bespoke quiz/bingo/band/
-- private cards are unaffected.
alter table public.event_types
  add column if not exists booking_grouping text not null default 'per_event';

alter table public.event_types
  drop constraint if exists event_types_booking_grouping_check;

alter table public.event_types
  add constraint event_types_booking_grouping_check
  check (booking_grouping in ('per_event', 'per_subtype', 'per_type'));

comment on column public.event_types.booking_grouping is
  'Public booking-hub grouping for this category: per_event | per_subtype | per_type.';
