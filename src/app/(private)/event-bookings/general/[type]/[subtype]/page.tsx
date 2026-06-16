export const dynamic = "force-dynamic";

import React from "react";
import { badgeClassFromColor } from "@/lib/event-type-colors";
import { getEventsForType, getBookingsForType, getEventDetailsForType } from "./actions";
import EventTypeFilter from "./components/event-filter";
import { type GeneralBooking } from "./components/booking-list";
import BookingsSection, { type EventSummary } from "./components/bookings-section";

function toTitleCase(str: string) {
  return str
    .split(/[\s\-_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatTime(t?: string | null) {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default async function GeneralEventBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; subtype: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { type, subtype } = await params;
  const { eventId } = await searchParams;
  const selectedEventId = eventId ?? null;

  const [events, rawBookings, eventDetails] = await Promise.all([
    getEventsForType(type, subtype),
    getBookingsForType(type, subtype, selectedEventId),
    selectedEventId ? getEventDetailsForType(selectedEventId) : Promise.resolve(null),
  ]);

  const bookings = rawBookings as unknown as GeneralBooking[];

  const etType = eventDetails
    ? (Array.isArray(eventDetails.event_types) ? eventDetails.event_types[0] : eventDetails.event_types) as { name: string } | null
    : null;
  const etSub = eventDetails
    ? (Array.isArray(eventDetails.event_subtypes) ? eventDetails.event_subtypes[0] : eventDetails.event_subtypes) as { name: string; color?: string | null } | null
    : null;
  const et = (etType || etSub) ? { type: etType?.name ?? "", sub_type: etSub?.name ?? "", badge_color: etSub?.color ?? null } : null;

  const hostName = eventDetails?.host && !Array.isArray(eventDetails.host)
    ? (eventDetails.host as { full_name: string }).full_name
    : null;

  // Pre-format the event summary so the client section stays presentational.
  const summary: EventSummary | null = selectedEventId && eventDetails
    ? {
        dateLabel: new Date(eventDetails.date + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
        }),
        timeLabel: `${formatTime(eventDetails.start_time)} – ${formatTime(eventDetails.end_time)}`,
        hostName: hostName ?? "—",
        badgeClass: et ? badgeClassFromColor(et.badge_color) : null,
        badgeLabel: et ? toTitleCase(et.sub_type || et.type) : null,
      }
    : null;

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-2 md:p-8 max-w-7xl mx-auto space-y-4">

        {/* Back + title */}
        {/* <div>
          <Link
            href="/event-bookings"
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#5F624F] hover:text-[#1F1F1A] transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Event Bookings
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight leading-tight">
              {toTitleCase(subtype)}
            </h1>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F] opacity-50">
              {toTitleCase(type)}
            </span>
          </div>
        </div> */}

        {/* Event selector */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1.5">
          <EventTypeFilter
            events={events}
            selectedEventId={selectedEventId}
            label={toTitleCase(subtype)}
          />
        </div>

        {/* Event summary + interactive stats bar + bookings list */}
        <BookingsSection bookings={bookings} summary={summary} />
      </div>
    </div>
  );
}
