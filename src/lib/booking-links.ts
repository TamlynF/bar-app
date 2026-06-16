import type { EventBehavior } from "@/lib/event-behavior";

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
 * Public booking-page URL for an event.
 *
 * Quiz and bingo use their bespoke date-keyed pages; everything else uses the
 * generic /book/event/[id] page. Returns null when the event isn't bookable; a
 * manual override URL wins outright.
 */
export function publicBookingUrl(opts: {
  behavior: EventBehavior | null | undefined;
  isBookable: boolean;
  manualUrl: string | null;
  siteUrl: string;
  date: string;
  eventId: number | string;
}): string | null {
  const { behavior, isBookable, manualUrl, siteUrl, date, eventId } = opts;
  if (!isBookable) return null;
  if (manualUrl) return manualUrl;
  if (behavior === "quiz") return `${siteUrl}/book/quiz?date=${date}`;
  if (behavior === "bingo") return `${siteUrl}/book/bingo?date=${date}`;
  return `${siteUrl}/book/event/${eventId}`;
}
