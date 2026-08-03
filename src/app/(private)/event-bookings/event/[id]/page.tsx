import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type GeneralBooking } from "../../general/[type]/[subtype]/components/booking-list";
import BookingsSection, { type EventSummary } from "../../general/[type]/[subtype]/components/bookings-section";
import { getQuizStatsForEvent } from "../../general/[type]/[subtype]/actions";

export const dynamic = "force-dynamic";

type EventRow = {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  payment_amount: number | null;
  seating_required: boolean | null;
  is_active: boolean | null;
  host_employee_id: number | null;
  event_types: { name: string } | { name: string }[];
  event_subtypes:
    | { name: string; color: string | null; behavior: string | null }
    | { name: string; color: string | null; behavior: string | null }[];
  employees: { full_name: string } | null;
};

type BookingRow = {
  id: number;
  group_name: string | null;
  group_size: number | null;
  status: string | null;
  payment_status: string | null;
  paid_amount: number | null;
  total_amount: number | null;
  special_requests: string | null;
  created_at: string;
  contacts: {
    full_name: string | null;
    email: string | null;
    country_code: string | null;
    phone_no: string | null;
  } | null;
  booking_table_mappings: {
    tables: { id: number; name: string; max_capacity: number } | null;
  }[];
};

function formatTime(t?: string | null) {
  if (!t) return "-";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; bookingId?: string }>;
}) {
  const { id } = await params;
  const { status, bookingId } = await searchParams;
  const eventId = Number(id);
  if (isNaN(eventId)) notFound();

  const initialStatuses = status
    ? status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const supabase = await createClient();

  const [{ data: rawEvent }, { data: rawBookings }, { data: tablesData }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, date, start_time, end_time, title, payment_amount, seating_required, is_active, host_employee_id, event_types(name), event_subtypes(name, color, behavior), employees!host_employee_id(full_name)"
      )
      .eq("id", eventId)
      .single(),
    supabase
      .from("bookings")
      .select(
        `id, group_name, group_size, status, payment_status, paid_amount, total_amount, special_requests, created_at,
        contacts!bookings_contact_id_fkey(full_name, email, country_code, phone_no),
        booking_table_mappings(tables(id, name, max_capacity))`
      )
      .eq("event_id", eventId)
      .order("group_name"),
    supabase.from("tables").select("max_capacity").eq("available", true),
  ]);

  if (!rawEvent) notFound();

  const event = rawEvent as unknown as EventRow;
  const bookings = (rawBookings ?? []) as unknown as BookingRow[];

  const etSub = Array.isArray(event.event_subtypes) ? event.event_subtypes[0] : event.event_subtypes;
  const seatingRequired = event.seating_required !== false;
  const isQuiz = etSub?.behavior === "quiz";
  const eventPrice = event.payment_amount ?? 0;
  const hostName =
    event.employees && !Array.isArray(event.employees) ? event.employees.full_name : null;

  let totalExpected = 0;
  let totalPaid = 0;
  for (const b of bookings) {
    if ((b.status || "").toLowerCase() === "cancelled") continue;
    totalPaid += Number(b.paid_amount) || 0;
    totalExpected +=
      b.total_amount != null ? Number(b.total_amount) : eventPrice * (Number(b.group_size) || 0);
  }

  let seated: { assigned: number; total: number } | null = null;
  if (seatingRequired) {
    let assigned = 0;
    for (const b of bookings) {
      assigned += (b.booking_table_mappings ?? []).filter((m) => m.tables).length;
    }
    seated = { assigned, total: (tablesData ?? []).length };
  }

  let quiz: EventSummary["quiz"] = null;
  if (isQuiz) {
    const stats = await getQuizStatsForEvent(eventId);
    const qs =
      stats.categoryTotal === 0
        ? "Not Started"
        : stats.questionCount >= stats.categoryTotal
        ? "Complete"
        : stats.questionCount > 0
        ? "Incomplete"
        : "Not Started";
    quiz = { status: qs, count: stats.questionCount, total: stats.categoryTotal };
  }

  const summary: EventSummary = {
    eventId: String(eventId),
    title: event.title ?? "",
    isActive: event.is_active !== false,
    dateLabel: new Date(event.date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    timeLabel: `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`,
    hostName: hostName ?? "-",
    paymentAmount: event.payment_amount ?? null,
    totalExpected,
    totalPaid,
    seatingRequired,
    seated,
    quiz,
  };

  const generalBookings: GeneralBooking[] = bookings.map((b) => ({
    id: String(b.id),
    event_id: String(eventId),
    group_name: b.group_name,
    group_size: b.group_size,
    status: b.status,
    payment_status: b.payment_status,
    paid_amount: b.paid_amount,
    total_amount: b.total_amount,
    special_requests: b.special_requests,
    booking_created_at: b.created_at,
    contacts: b.contacts
      ? {
          full_name: b.contacts.full_name ?? undefined,
          email: b.contacts.email ?? undefined,
          country_code: b.contacts.country_code ?? undefined,
          phone_no: b.contacts.phone_no ?? undefined,
        }
      : null,
    events: {
      event_date: event.date,
      event_start_time: event.start_time,
      event_title: event.title,
      event_payment_amount: event.payment_amount,
      seating_required: event.seating_required,
    },
    booking_table_mappings: (b.booking_table_mappings ?? []).map((m) => ({
      tables: m.tables
        ? {
            tables_id: String(m.tables.id),
            tables_name: m.tables.name,
            tables_capacity: m.tables.max_capacity,
          }
        : null,
    })),
  }));

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:py-0 md:px-8">
        <BookingsSection
          bookings={generalBookings}
          summary={summary}
          events={[]}
          selectedEventId={String(eventId)}
          todayIso={new Date().toISOString().split("T")[0]}
          showEventPicker={false}
          initialStatuses={initialStatuses}
          initialSelectedId={bookingId ?? null}
        />
      </div>
    </div>
  );
}
