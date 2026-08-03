export const dynamic = "force-dynamic";

import React from "react";
import { getEventsForType, getBookingsForType, getEventDetailsForType, getAllTables, getQuizStatsForEvent, getTypeRequestKind, getBandRequestsForType, getPrivateHireRequestsForType, getNextActiveEventIdForType } from "./actions";
import { ALL_SUBTYPES } from "@/lib/booking-grouping";
import { type GeneralBooking } from "./components/booking-list";
import BookingsSection, { type EventSummary } from "./components/bookings-section";
import BandBookingListClient from "../../../music-bookings/components/band-booking-list-client";
import { type BandRequest } from "../../../music-bookings/components/band-booking-card";
import PrivateHireListClient from "../../../private-bookings/components/private-hire-list-client";
import { type PrivateHireRequest } from "../../../private-bookings/components/private-hire-card";

function RequestsShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex-1 bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:py-0 md:px-8">
        <div>
          <h2 className="text-xl leading-tight font-bold tracking-tight text-[#20231A]">{title}</h2>
          <p className="mt-1 text-sm leading-normal text-[#5E6654]">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatTime(t?: string | null) {
  if (!t) return "-";
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
  searchParams: Promise<{ eventId?: string; status?: string; all?: string; bookingId?: string }>;
}) {
  const { type, subtype } = await params;
  const { eventId, status, all, bookingId } = await searchParams;
  let selectedEventId = eventId ?? null;
  const initialStatuses = status
    ? status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const isAllSubtypes = subtype === ALL_SUBTYPES;

  const requestKind = isAllSubtypes ? await getTypeRequestKind(type) : null;
  if (requestKind === "music_act") {
    const requests = (await getBandRequestsForType()) as unknown as BandRequest[];
    return (
      <RequestsShell title="Band applications" subtitle="Review and respond to artist bookings">
        <BandBookingListClient initialRequests={requests} initialStatuses={initialStatuses} />
      </RequestsShell>
    );
  }
  if (requestKind === "private") {
    const requests = (await getPrivateHireRequestsForType()) as unknown as PrivateHireRequest[];
    return (
      <RequestsShell title="Private hire" subtitle="Review and respond to venue hire enquiries">
        <PrivateHireListClient initialRequests={requests} initialStatuses={initialStatuses} />
      </RequestsShell>
    );
  }

  if (!selectedEventId && !status && !all) {
    selectedEventId = await getNextActiveEventIdForType(type, subtype);
  }

  const [events, rawBookings, eventDetails] = await Promise.all([
    getEventsForType(type, subtype),
    getBookingsForType(type, subtype, selectedEventId),
    selectedEventId ? getEventDetailsForType(selectedEventId) : Promise.resolve(null),
  ]);

  const bookings = rawBookings as unknown as GeneralBooking[];

  const etSub = eventDetails
    ? (Array.isArray(eventDetails.event_subtypes) ? eventDetails.event_subtypes[0] : eventDetails.event_subtypes) as { name: string; color?: string | null; behavior?: string | null } | null
    : null;

  const hostName = eventDetails?.host && !Array.isArray(eventDetails.host)
    ? (eventDetails.host as { full_name: string }).full_name
    : null;

  const seatingRequired = !!(eventDetails as { seating_required?: boolean | null } | null)?.seating_required;
  const isQuiz = etSub?.behavior === "quiz";
  const paymentAmount = (eventDetails as { payment_amount?: number | null } | null)?.payment_amount ?? null;
  const isActive = (eventDetails as { is_active?: boolean | null } | null)?.is_active !== false;

  let totalExpected = 0;
  let totalPaid = 0;
  for (const b of bookings) {
    if ((b.status || "").toLowerCase() === "cancelled") continue;
    totalPaid += Number(b.paid_amount) || 0;
    const lineTotal = b.total_amount != null
      ? Number(b.total_amount)
      : (paymentAmount ?? 0) * (Number(b.group_size) || 0);
    totalExpected += lineTotal;
  }

  let seated: { assigned: number; total: number } | null = null;
  if (selectedEventId && eventDetails && seatingRequired) {
    const allTables = await getAllTables();
    let assigned = 0;
    for (const b of bookings) {
      assigned += (b.booking_table_mappings ?? []).filter(m => m.tables).length;
    }
    seated = { assigned, total: allTables.length };
  }

  let quiz: EventSummary["quiz"] = null;
  if (selectedEventId && eventDetails && isQuiz) {
    const stats = await getQuizStatsForEvent(Number(eventDetails.id));
    const status =
      stats.categoryTotal === 0
        ? "Not Started"
        : stats.questionCount >= stats.categoryTotal
        ? "Complete"
        : stats.questionCount > 0
        ? "Incomplete"
        : "Not Started";
    quiz = { status, count: stats.questionCount, total: stats.categoryTotal };
  }

  const summary: EventSummary | null = selectedEventId && eventDetails
    ? {
        eventId: selectedEventId,
        title: eventDetails.title ?? "",
        isActive,
        dateLabel: new Date(eventDetails.date + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "2-digit",
        }),
        timeLabel: `${formatTime(eventDetails.start_time)} – ${formatTime(eventDetails.end_time)}`,
        hostName: hostName ?? "-",
        paymentAmount,
        totalExpected,
        totalPaid,
        seatingRequired,
        seated,
        quiz,
      }
    : null;

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:py-0 md:px-8">
        <BookingsSection
          bookings={bookings}
          summary={summary}
          events={events}
          selectedEventId={selectedEventId}
          todayIso={new Date().toISOString().split("T")[0]}
          initialStatuses={initialStatuses}
          initialSelectedId={bookingId ?? null}
        />
      </div>
    </div>
  );
}
