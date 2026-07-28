import type { EventBehavior } from "@/lib/event-behavior";
import type { BookingGrouping } from "@/lib/booking-grouping";

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

export function checkoutReturnPath(opts: {
  behavior: EventBehavior | null | undefined;
  eventId: number | string;
  bookingId: number | string;
}): string {
  if (opts.behavior === "bingo") {
    return `/book/bingo/success?bookingId=${opts.bookingId}`;
  }
  return `/book/event/${opts.eventId}/success?bookingId=${opts.bookingId}`;
}

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
  return `${siteUrl}/book/event/${eventId}`;
}
