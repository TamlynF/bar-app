export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeClassFromColor } from "@/lib/event-type-colors";
import { getEventsForType, getBookingsForType, getEventDetailsForType } from "./actions";
import EventTypeFilter from "./components/event-filter";
import BookingList, { type GeneralBooking } from "./components/booking-list";

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

  const confirmed  = bookings.filter(b => b.status === "confirmed");
  const waitlisted = bookings.filter(b => b.status === "waitlisted");
  const pending    = bookings.filter(b => b.status === "pending");
  const cancelled  = bookings.filter(b => b.status === "cancelled");

  const et = eventDetails
    ? (Array.isArray(eventDetails.event_types) ? eventDetails.event_types[0] : eventDetails.event_types) as { type: string; sub_type: string; badge_color?: string | null } | null
    : null;

  const hostName = eventDetails?.host && !Array.isArray(eventDetails.host)
    ? (eventDetails.host as { full_name: string }).full_name
    : null;

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-5">

        {/* Back + title */}
        <div>
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
        </div>

        {/* Event selector */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1.5">
          <EventTypeFilter
            events={events}
            selectedEventId={selectedEventId}
            label={toTitleCase(subtype)}
          />
        </div>

        {/* Event summary */}
        {selectedEventId && eventDetails ? (
          <div className="bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              {/* Date */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Date</span>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">
                    {new Date(eventDetails.date + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {/* Time */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Time</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">
                    {formatTime(eventDetails.start_time)} – {formatTime(eventDetails.end_time)}
                  </span>
                </div>
              </div>
              {/* Host */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Host</span>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">{hostName ?? "—"}</span>
                </div>
              </div>
              {/* Type badge */}
              {et && (
                <div className="ml-auto self-start">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wide px-2.5 py-1 rounded-md",
                    badgeClassFromColor(et.badge_color)
                  )}>
                    {toTitleCase(et.sub_type || et.type)}
                  </span>
                </div>
              )}
            </div>

            {/* Booking counts */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-[#E6DFC8]">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-[10px] font-black uppercase tracking-wider text-green-700">
                {confirmed.length} Confirmed
              </span>
              {waitlisted.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-700">
                  {waitlisted.length} Waitlisted
                </span>
              )}
              {pending.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {pending.length} Pending
                </span>
              )}
              {cancelled.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F7F4EA] border border-[#E6DFC8] rounded-full text-[10px] font-black uppercase tracking-wider text-[#5F624F]">
                  {cancelled.length} Cancelled
                </span>
              )}
            </div>
          </div>
        ) : !selectedEventId ? (
          <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
            <div className="p-3 bg-[#F7F4EA] rounded-2xl">
              <CalendarDays className="w-6 h-6 text-[#5C4033] opacity-30" />
            </div>
            <p className="text-[10px] font-bold uppercase text-[#5F624F] tracking-wide opacity-60 max-w-[200px] leading-relaxed">
              Select an event above to filter by date
            </p>
          </div>
        ) : null}

        {/* Bookings section */}
        <div className="space-y-3">
          <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
            Bookings ({bookings.length})
          </span>
          <BookingList bookings={bookings} />
        </div>
      </div>
    </div>
  );
}
