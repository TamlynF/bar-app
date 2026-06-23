import type { EventBehavior } from "@/lib/event-behavior";
import type { BookingGrouping } from "@/lib/booking-grouping";

/**
 * Admin deep-link to an event's bookings, chosen by its sub-type behavior.
 *
 * Quiz / bingo / music / private each have a dedicated admin screen; anything
 * else falls back to the generic per-event bookings page (when an id is known)
 * or the bookings hub. Pure so it can be unit-tested away from the dashboard
 * Server Component that wraps it.
 */
export function adminBookingsHref(behavior: EventBehavior, eventId?: number): string {
  switch (behavior) {
    case "bingo": return "/event-bookings/bingo-bookings";
    case "quiz": return "/event-bookings/quiz-bookings";
    case "music_act": return "/event-bookings/music-bookings";
    case "private": return "/event-bookings/private-bookings";
  }
  if (eventId) return `/event-bookings/event/${eventId}`;
  return "/event-bookings";
}

/**
 * Public booking-page URL for an event, chosen by its category's grouping
 * (`event_types.booking_grouping`):
 *
 *   per_type    → /book/group/type/{eventTypesId}?id={eventId}
 *   per_subtype → /book/group/subtype/{eventSubtypesId}?id={eventId}
 *                 (falls back to per_event when the event has no subtype)
 *   per_event   → /book/event/{eventId}
 *
 * The `?id=` pre-selects the specific event on the grouped booking page.
 * Returns null when the event isn't bookable; a manual override URL wins
 * outright. Pure so it can be unit-tested away from the Server Action.
 */
export function publicBookingUrl(opts: {
  grouping: BookingGrouping | null | undefined;
  isBookable: boolean;
  manualUrl: string | null;
  siteUrl: string;
  eventTypesId: number;
  eventSubtypesId: number | null;
  eventId: number | string;
}): string | null {
  const { grouping, isBookable, manualUrl, siteUrl, eventTypesId, eventSubtypesId, eventId } = opts;
  if (!isBookable) return null;
  if (manualUrl) return manualUrl;

  if (grouping === "per_type") {
    return `${siteUrl}/book/group/type/${eventTypesId}?id=${eventId}`;
  }
  if (grouping === "per_subtype" && eventSubtypesId) {
    return `${siteUrl}/book/group/subtype/${eventSubtypesId}?id=${eventId}`;
  }
  // per_event, or per_subtype with no subtype to group by.
  return `${siteUrl}/book/event/${eventId}`;
}
