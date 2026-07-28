import type { EventBehavior } from "@/lib/event-behavior";
import { ALL_SUBTYPES, type BookingGrouping } from "@/lib/booking-grouping";

export interface AdminBookingsHrefOptions {
  behavior?: EventBehavior | null;
  bookingGrouping?: BookingGrouping | null;
  eventType?: string | null;
  eventSubtype?: string | null;
  eventId?: number | string | null;
  bookingId?: number | string | null;
}

function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${path}?${query}` : path;
}

export function adminBookingsHref(opts: AdminBookingsHrefOptions): string {
  const { bookingGrouping, eventType, eventSubtype, eventId, bookingId } = opts;

  if (bookingGrouping && eventId) {
    if (bookingGrouping === "per_event") {
      return withQuery(`/event-bookings/event/${eventId}`, { bookingId });
    }
    if (eventType) {
      const subtypeSegment =
        bookingGrouping === "per_subtype" && eventSubtype
          ? encodeURIComponent(eventSubtype)
          : ALL_SUBTYPES;
      return withQuery(
        `/event-bookings/general/${encodeURIComponent(eventType)}/${subtypeSegment}`,
        { eventId, bookingId }
      );
    }
  }

  if (eventId) return withQuery(`/event-bookings/event/${eventId}`, { bookingId });
  return "/event-bookings";
}

export function manageBookingPath(
  behavior: EventBehavior | null | undefined,
  bookingId: number | string
): string {
  switch (behavior) {
    case "quiz": return `/book/quiz/manage-booking/${bookingId}`;
    case "bingo": return `/book/bingo/manage-booking/${bookingId}`;
    default: return `/manage-booking/${bookingId}`;
  }
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
