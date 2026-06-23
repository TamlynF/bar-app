/**
 * How an event category (`event_types`) presents its bookable events on the
 * public `/book` hub. Stored on `event_types.booking_grouping`.
 *
 *   'per_event'   — one card per event (historical behaviour), linking to
 *                   /book/event/[id].
 *   'per_subtype' — events collapsed by sub-type into one card/page per
 *                   sub-type, with a date dropdown (/book/group/subtype/[id]).
 *   'per_type'    — all the category's events collapsed into one card/page,
 *                   with a date dropdown (/book/group/type/[id]).
 *
 * Only affects the generic "Upcoming Events" list — the bespoke quiz/bingo/
 * band/private cards are unaffected.
 */
/**
 * Sentinel used in the admin `/event-bookings/general/[type]/[subtype]` route's
 * `subtype` segment to mean "all sub-types of this category" — used by the
 * `per_type` grouping so a whole category's bookings show on one page.
 */
export const ALL_SUBTYPES = "__all__";

export const BOOKING_GROUPINGS = ["per_type", "per_subtype","per_event"] as const;

export type BookingGrouping = (typeof BOOKING_GROUPINGS)[number];

export const BOOKING_GROUPING_LABELS: Record<BookingGrouping, string> = {
  per_event: "Per Individual Event",
  per_subtype: "Per Sub-Category",
  per_type: "Per Category",
};

/** Ordered options for the category editor's grouping selector. */
export const BOOKING_GROUPING_OPTIONS: { value: BookingGrouping; label: string }[] =
  BOOKING_GROUPINGS.map((value) => ({ value, label: BOOKING_GROUPING_LABELS[value] }));

/** Narrow an unknown value (e.g. a DB column or form field) to BookingGrouping. */
export function isBookingGrouping(value: unknown): value is BookingGrouping {
  return (
    typeof value === "string" &&
    (BOOKING_GROUPINGS as readonly string[]).includes(value)
  );
}
