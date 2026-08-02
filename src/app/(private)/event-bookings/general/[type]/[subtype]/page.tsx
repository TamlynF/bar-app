export const dynamic = "force-dynamic";

import React from "react";
import { badgeClassFromColor } from "@/lib/event-type-colors";
import { getEventsForType, getBookingsForType, getEventDetailsForType, getAllTables, getQuizStatsForEvent, getTypeRequestKind, getBandRequestsForType, getPrivateHireRequestsForType, getNextActiveEventIdForType } from "./actions";
import { ALL_SUBTYPES } from "@/lib/booking-grouping";
import EventTypeFilter from "./components/event-filter";
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
          <h2 className="font-black text-xl tracking-tight text-[#20231A] uppercase">{title}</h2>
          <p className="mt-0.5 text-xs text-[#5E6654]">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function toTitleCase(str: string) {
  return str
    .split(/[\s\-_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  const filterLabel = isAllSubtypes ? toTitleCase(type) : toTitleCase(subtype);

  const requestKind = isAllSubtypes ? await getTypeRequestKind(type) : null;
  if (requestKind === "music_act") {
    const requests = (await getBandRequestsForType()) as unknown as BandRequest[];
    return (
      <RequestsShell title="Band Applications" subtitle="Review and respond to artist bookings">
        <BandBookingListClient initialRequests={requests} initialStatuses={initialStatuses} />
      </RequestsShell>
    );
  }
  if (requestKind === "private") {
    const requests = (await getPrivateHireRequestsForType()) as unknown as PrivateHireRequest[];
    return (
      <RequestsShell title="Private Hire" subtitle="Review and respond to venue hire enquiries">
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

  const etType = eventDetails
    ? (Array.isArray(eventDetails.event_types) ? eventDetails.event_types[0] : eventDetails.event_types) as { name: string } | null
    : null;
  const etSub = eventDetails
    ? (Array.isArray(eventDetails.event_subtypes) ? eventDetails.event_subtypes[0] : eventDetails.event_subtypes) as { name: string; color?: string | null; behavior?: string | null } | null
    : null;
  const et = (etType || etSub) ? { type: etType?.name ?? "", sub_type: etSub?.name ?? "", badge_color: etSub?.color ?? null } : null;

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

  let tableStats: { capacity: number; total: number; assigned: number }[] | null = null;
  if (selectedEventId && eventDetails && seatingRequired) {
    const allTables = await getAllTables();
    const groups: Record<number, { total: number; assigned: number }> = {};
    for (const t of allTables) {
      const cap = t.max_capacity || 0;
      if (!groups[cap]) groups[cap] = { total: 0, assigned: 0 };
      groups[cap].total++;
    }
    for (const b of bookings) {
      for (const m of b.booking_table_mappings ?? []) {
        const cap = m.tables?.tables_capacity || 0;
        if (groups[cap]) groups[cap].assigned++;
      }
    }
    tableStats = Object.entries(groups)
      .map(([cap, v]) => ({ capacity: Number(cap), ...v }))
      .sort((a, b) => a.capacity - b.capacity);
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
        title: eventDetails.title ?? "",
        isActive,
        dateLabel: new Date(eventDetails.date + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
        }),
        timeLabel: `${formatTime(eventDetails.start_time)} – ${formatTime(eventDetails.end_time)}`,
        hostName: hostName ?? "-",
        badgeClass: et ? badgeClassFromColor(et.badge_color) : null,
        badgeLabel: et ? toTitleCase(et.sub_type || et.type) : null,
        paymentAmount,
        totalExpected,
        totalPaid,
        quiz,
        tableStats,
      }
    : null;

  return (
    <div className="min-h-screen flex-1 bg-background xl:min-h-0">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 sm:py-0 md:px-8 xl:flex xl:h-[calc(100vh-7.5rem)] xl:flex-col xl:overflow-hidden">

        <BookingsSection
          bookings={bookings}
          summary={summary}
          type={type}
          subtype={subtype}
          initialStatuses={initialStatuses}
          initialSelectedId={bookingId ?? null}
          eventFilter={
            <div className="w-full rounded-2xl border border-[#D8D5C8] bg-white p-1.5 shadow-sm sm:rounded-xl sm:p-1">
              <EventTypeFilter
                events={events}
                selectedEventId={selectedEventId}
                label={filterLabel}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
