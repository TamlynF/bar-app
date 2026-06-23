-- Backfill events.booking_page_url to the grouping-based booking URLs, matching
-- the generator in src/lib/booking-links.ts (publicBookingUrl):
--
--   per_type    -> /book/group/type/{event_types_id}?id={id}
--   per_subtype -> /book/group/subtype/{event_subtypes_id}?id={id}
--                  (falls back to per_event when the event has no subtype)
--   per_event   -> /book/event/{id}
--
-- This local migration uses relative paths (host-agnostic, fine for in-app
-- navigation and E2E). In PRODUCTION, run the equivalent UPDATE once via the
-- Supabase SQL editor / MCP, prefixing each path with NEXT_PUBLIC_SITE_URL
-- (e.g. 'https://bar-app-tau.vercel.app') so the admin "copy link" stays
-- shareable.
--
-- Note: a manual/hand-typed override cannot be distinguished from a previously
-- auto-generated value (they share this column), so this overwrites all rows.
-- Re-enter any genuinely custom links in the event editor's Booking URL field.

UPDATE events e SET booking_page_url = CASE
  WHEN e.is_bookable IS NOT TRUE THEN NULL
  WHEN et.booking_grouping = 'per_type'
    THEN '/book/group/type/'    || e.event_types_id    || '?id=' || e.id
  WHEN et.booking_grouping = 'per_subtype' AND e.event_subtypes_id IS NOT NULL
    THEN '/book/group/subtype/' || e.event_subtypes_id || '?id=' || e.id
  ELSE '/book/event/' || e.id
END
FROM event_types et
WHERE e.event_types_id = et.id;
