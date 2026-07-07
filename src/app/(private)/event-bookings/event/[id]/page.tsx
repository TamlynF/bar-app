import React from "react";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BookingsList, type BookingItem } from "./bookings-list";

export const dynamic = "force-dynamic";

type EventRow = {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  payment_amount: number | null;
  host_employee_id: number | null;
  event_types: { name: string } | { name: string }[];
  event_subtypes: { name: string; color: string | null } | { name: string; color: string | null }[];
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

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;
  const eventId = Number(id);
  if (isNaN(eventId)) notFound();

  // Optional status pre-filter (e.g. ?status=confirmed) — comma-separated,
  // case-insensitive. Applied to the bookings list below (the summary card
  // still reflects the whole event).
  const statusFilter = new Set(
    (status ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );

  const supabase = await createClient();

  const [{ data: rawEvent }, { data: rawBookings }, { data: tablesData }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, date, start_time, end_time, title, payment_amount, host_employee_id, event_types(name), event_subtypes(name, color), employees!host_employee_id(full_name)"
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
      .order("status")
      .order("group_name"),
    supabase.from("tables").select("max_capacity").eq("available", true),
  ]);

  if (!rawEvent) notFound();

  const event = rawEvent as unknown as EventRow;
  const bookings = (rawBookings ?? []) as unknown as BookingRow[];
  const totalVenueCapacity = (tablesData ?? []).reduce((s, t) => s + (t.max_capacity ?? 0), 0);

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

  const eventPrice = event.payment_amount ?? 0;
  const bookingItems: BookingItem[] = bookings.map((b) => ({
    id: b.id,
    groupName: b.group_name ?? "—",
    size: b.group_size ?? 0,
    status: b.status ?? "",
    paid: b.paid_amount ?? 0,
    total: b.total_amount ?? eventPrice * (b.group_size ?? 0),
    request: b.special_requests,
    createdAt: format(parseISO(b.created_at), "EEE d MMM yyyy"),
    contactName: b.contacts?.full_name ?? null,
    contactEmail: b.contacts?.email ?? null,
    contactPhone: b.contacts
      ? `${b.contacts.country_code ?? ""}${b.contacts.phone_no ?? ""}`.trim() || null
      : null,
    tables: b.booking_table_mappings.map((m) => m.tables?.name).filter(Boolean).join(", "),
  }));

  const visibleItems = statusFilter.size
    ? bookingItems.filter((b) => statusFilter.has((b.status || "").toLowerCase()))
    : bookingItems;

  return (
    <div className="px-4 py-4 md:px-8 sm:py-0 max-w-4xl mx-auto space-y-6">

      {/* Event detail card */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
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
                capacityPct > 90 ? "bg-red-500" : "bg-[#5C4033]"
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
      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          Bookings ({visibleItems.length})
          {statusFilter.size > 0 && (
            <span className="ml-1.5 font-bold normal-case tracking-normal text-[#5F624F]/70">
              · filtered by {[...statusFilter].join(", ")}
            </span>
          )}
        </h2>

        {visibleItems.length === 0 ? (
          <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
            <p className="text-sm font-black text-[#1F1F1A]">
              {bookings.length === 0 ? "No bookings yet" : "No matching bookings"}
            </p>
            <p className="text-[11px] text-[#5F624F] mt-1">
              {bookings.length === 0
                ? "Bookings will appear here once guests register."
                : "No bookings match the current status filter."}
            </p>
          </div>
        ) : (
          <BookingsList
            items={visibleItems}
            event={{
              title: event.title ?? "Untitled Event",
              dateLabel: format(parsed, "EEE d MMM yyyy"),
              startTime,
              price: eventPrice,
            }}
          />
        )}
      </section>
    </div>
  );
}
