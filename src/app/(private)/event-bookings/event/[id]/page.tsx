import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, Clock, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EventTypeRow = { type: string; sub_type: string } | null;

type EventRow = {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  host_employee_id: number | null;
  event_types: EventTypeRow | EventTypeRow[];
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

function getEventType(ev: EventRow): EventTypeRow {
  return (Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types) ?? null;
}

function badgeClass(et: EventTypeRow): string {
  if (!et) return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
  const t = `${et.sub_type} ${et.type}`.toLowerCase();
  if (t.includes("quiz")) return "bg-amber-100 text-amber-700 border border-amber-200";
  if (t.includes("band") || t.includes("music")) return "bg-purple-100 text-purple-700 border border-purple-200";
  if (t.includes("private") || t.includes("hire")) return "bg-blue-100 text-blue-700 border border-blue-200";
  if (t.includes("bingo")) return "bg-green-100 text-green-700 border border-green-200";
  return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
}

function badgeLabel(et: EventTypeRow): string {
  const raw = et?.sub_type || et?.type || "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/-/g, " ");
}

function statusBadge(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700 border border-green-200";
    case "waitlisted":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "cancelled":
      return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
    default:
      return "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) notFound();

  const supabase = await createClient();

  const [{ data: rawEvent }, { data: rawBookings }, { data: tablesData }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, date, start_time, end_time, title, host_employee_id, event_types(type, sub_type), employees!host_employee_id(full_name)"
      )
      .eq("id", eventId)
      .single(),
    supabase
      .from("bookings")
      .select(
        `id, group_name, group_size, status, payment_status, paid_amount, total_amount, special_requests, created_at,
        contacts(full_name, email, country_code, phone_no),
        booking_table_mappings(tables(id, name, max_capacity))`
      )
      .eq("event_id", eventId)
      .order("status")
      .order("group_name"),
    supabase.from("tables").select("max_capacity").eq("available", true),
  ]);

  if (!rawEvent) notFound();

  const event = rawEvent as unknown as EventRow;
  const bookings = (rawBookings ?? []) as unknown as BookingRow[];
  const totalVenueCapacity = (tablesData ?? []).reduce((s, t) => s + (t.max_capacity ?? 0), 0);

  const et = getEventType(event);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const waitlisted = bookings.filter((b) => b.status === "waitlisted");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const confirmedGuests = confirmed.reduce((s, b) => s + (b.group_size ?? 0), 0);
  const capacityPct = totalVenueCapacity > 0 ? Math.round((confirmedGuests / totalVenueCapacity) * 100) : 0;

  const hostName =
    event.employees && !Array.isArray(event.employees)
      ? (event.employees as { full_name: string }).full_name
      : null;

  const parsed = parseISO(event.date);
  const startTime = event.start_time ? event.start_time.substring(0, 5) : null;
  const endTime = event.end_time ? event.end_time.substring(0, 5) : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

      {/* Back + title */}
      <div>
        <Link
          href="/event-bookings"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#5F624F] hover:text-[#1F1F1A] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Events
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tight leading-tight flex-1">
            {event.title ?? "Untitled Event"}
          </h1>
          {et && (
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 mt-1",
              badgeClass(et)
            )}>
              {badgeLabel(et)}
            </span>
          )}
        </div>
      </div>

      {/* Event detail card */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12px]">
          <div className="flex items-center gap-2 text-[#5F624F]">
            <CalendarDays className="w-4 h-4 shrink-0 opacity-60" />
            <span className="font-medium">{format(parsed, "EEE d MMM yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-[#5F624F]">
            <Clock className="w-4 h-4 shrink-0 opacity-60" />
            <span className="font-medium">
              {startTime ?? "--:--"}{endTime ? ` – ${endTime}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#5F624F]">
            <User className="w-4 h-4 shrink-0 opacity-60" />
            <span className="font-medium">{hostName ?? "Unassigned"}</span>
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#5F624F] font-medium">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 opacity-60" />
              Capacity
            </span>
            <span className="font-black text-[#1F1F1A]">
              {confirmedGuests} / {totalVenueCapacity} — {capacityPct}%
            </span>
          </div>
          <div className="h-2 bg-[#F7F4EA] rounded-full overflow-hidden border border-[#E6DFC8]">
            <div
              className={cn(
                "h-full rounded-full transition-all capacity-fill",
                capacityPct > 90 ? "bg-red-500" : "bg-[#26300D]"
              )}
              style={{ '--bar-width': `${Math.min(capacityPct, 100)}%` } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Counts */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-[10px] font-black uppercase tracking-wider text-green-700">
            {confirmed.length} Confirmed
          </span>
          {waitlisted.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-700">
              {waitlisted.length} Waitlisted
            </span>
          )}
          {cancelled.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F7F4EA] border border-[#E6DFC8] rounded-full text-[10px] font-black uppercase tracking-wider text-[#5F624F]">
              {cancelled.length} Cancelled
            </span>
          )}
        </div>
      </div>

      {/* Bookings */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-[#5F624F]">
          Bookings ({bookings.length})
        </h2>

        {bookings.length === 0 ? (
          <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
            <p className="text-sm font-black text-[#1F1F1A]">No bookings yet</p>
            <p className="text-[11px] text-[#5F624F] mt-1">Bookings will appear here once guests register.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
            {bookings.map((b, i) => {
              const tables = b.booking_table_mappings
                .map((m) => m.tables?.name)
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={b.id}
                  className={cn(
                    "p-4 flex flex-col sm:flex-row sm:items-start gap-3",
                    i < bookings.length - 1 && "border-b border-[#E6DFC8]"
                  )}
                >
                  {/* Status badge */}
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 self-start",
                    statusBadge(b.status)
                  )}>
                    {b.status ?? "–"}
                  </span>

                  {/* Group name + contact */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-black text-[#1F1F1A] truncate">
                      {b.group_name ?? "–"}
                    </p>
                    {b.contacts?.full_name && (
                      <p className="text-[11px] text-[#5F624F] font-medium truncate">
                        {b.contacts.full_name}
                        {b.contacts.email && (
                          <span className="opacity-60"> · {b.contacts.email}</span>
                        )}
                      </p>
                    )}
                    {b.special_requests && (
                      <p className="text-[10px] text-[#5F624F] italic opacity-70 truncate">
                        {b.special_requests}
                      </p>
                    )}
                  </div>

                  {/* Size */}
                  <div className="shrink-0 text-center hidden sm:block">
                    <p className="text-sm font-black text-[#1F1F1A] tabular-nums">{b.group_size ?? "–"}</p>
                    <p className="text-[9px] text-[#5F624F] font-bold uppercase tracking-wider">guests</p>
                  </div>

                  {/* Table */}
                  <div className="shrink-0 hidden sm:block min-w-[5rem] text-right">
                    <p className="text-[11px] font-black text-[#1F1F1A]">{tables || "–"}</p>
                    <p className="text-[9px] text-[#5F624F] font-bold uppercase tracking-wider">table</p>
                  </div>

                  {/* Paid / Total */}
                  {(b.paid_amount !== null || b.total_amount !== null) && (
                    <div className="shrink-0 hidden sm:block text-right min-w-[5rem]">
                      <p className="text-[11px] font-black text-[#1F1F1A]">
                        £{(b.paid_amount ?? 0).toFixed(2)}
                        <span className="text-[#5F624F] font-medium"> / £{(b.total_amount ?? 0).toFixed(2)}</span>
                      </p>
                      <p className="text-[9px] text-[#5F624F] font-bold uppercase tracking-wider">paid</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
