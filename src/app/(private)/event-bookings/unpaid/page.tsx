import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, ChevronRight, Wallet, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { badgeClassFromColor } from "@/lib/event-type-colors";
import { isEventBehavior } from "@/lib/event-behavior";
import { adminBookingsHref } from "@/lib/booking-links";

export const dynamic = "force-dynamic";

function toTitleCase(str?: string | null) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t?: string | null) {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

type Rel<T> = T | T[] | null;
function first<T>(rel: Rel<T>): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

type RawBooking = {
  id: number;
  group_name: string | null;
  group_size: number | null;
  status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  contacts: Rel<{ full_name: string | null; email: string | null; phone_no: string | null }>;
  events: Rel<{
    id: number;
    date: string;
    start_time: string | null;
    title: string | null;
    is_active: boolean | null;
    event_types: Rel<{ name: string }>;
    event_subtypes: Rel<{ name: string; color: string | null; behavior: string | null }>;
  }>;
};

type UnpaidBooking = {
  id: number;
  groupName: string;
  guests: number;
  total: number;
  paid: number;
  outstanding: number;
  contactName: string;
};

type EventGroup = {
  eventId: number;
  date: string;
  startTime: string | null;
  title: string;
  typeName: string;
  subName: string;
  color: string | null;
  href: string;
  bookings: UnpaidBooking[];
  outstanding: number;
};

export default async function UnpaidBookingsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      group_name,
      group_size,
      status,
      total_amount,
      paid_amount,
      contacts!bookings_contact_id_fkey(full_name, email, phone_no),
      events!bookings_event_id_fkey!inner(
        id, date, start_time, title, is_active,
        event_types!inner(name),
        event_subtypes!inner(name, color, behavior)
      )
    `)
    .eq("status", "confirmed")
    .gt("total_amount", 0)
    .eq("events.is_active", true)
    .order("date", { referencedTable: "events", ascending: true });

  if (error) console.error("Unpaid bookings query error:", error);

  const rows = (data ?? []) as unknown as RawBooking[];

  // Group confirmed bookings that still owe money (paid < total) by their event.
  // Column-to-column comparison isn't expressible in the PostgREST filter, so the
  // paid < total check is applied here.
  const groupMap = new Map<number, EventGroup>();
  for (const b of rows) {
    const ev = first(b.events);
    if (!ev) continue;
    const total = b.total_amount ?? 0;
    const paid = b.paid_amount ?? 0;
    if (paid >= total) continue;

    if (!groupMap.has(ev.id)) {
      const et = first(ev.event_types);
      const es = first(ev.event_subtypes);
      const behavior = isEventBehavior(es?.behavior) ? es!.behavior : "standard";
      groupMap.set(ev.id, {
        eventId: ev.id,
        date: ev.date,
        startTime: ev.start_time,
        title: ev.title ?? "Untitled Event",
        typeName: et?.name ?? "",
        subName: es?.name ?? "",
        color: es?.color ?? null,
        href: adminBookingsHref(behavior, ev.id),
        bookings: [],
        outstanding: 0,
      });
    }
    const group = groupMap.get(ev.id)!;
    const contact = first(b.contacts);
    const outstanding = total - paid;
    group.bookings.push({
      id: b.id,
      groupName: b.group_name || contact?.full_name || "Unnamed booking",
      guests: b.group_size ?? 0,
      total,
      paid,
      outstanding,
      contactName: contact?.full_name ?? "",
    });
    group.outstanding += outstanding;
  }

  const groups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      bookings: g.bookings.sort((a, b) => b.outstanding - a.outstanding),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalOutstanding = groups.reduce((s, g) => s + g.outstanding, 0);
  const totalBookings = groups.reduce((s, g) => s + g.bookings.length, 0);

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="space-y-4 mx-auto px-3 md:px-8 py-3 sm:py-0 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-[#1F1F1A] text-xl uppercase tracking-tight">Unpaid Bookings</h2>
            <p className="mt-0.5 text-[#5F624F] text-xs">
              Confirmed bookings with an outstanding balance on active events, grouped by event.
            </p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-stretch gap-3 bg-white p-3 border border-[#E6DFC8] rounded-2xl shadow-sm">
          <div className="flex flex-col items-center justify-center flex-1 gap-0.5">
            <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide opacity-60">Outstanding</span>
            <span className={cn("font-black tabular-nums text-lg", totalOutstanding > 0 ? "text-[#b45309]" : "text-[#5F624F]")}>
              £{totalOutstanding.toFixed(2)}
            </span>
          </div>
          <div className="self-stretch bg-[#E6DFC8] w-px" />
          <div className="flex flex-col items-center justify-center flex-1 gap-0.5">
            <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide opacity-60">Bookings</span>
            <span className="font-black text-[#1F1F1A] tabular-nums text-lg">{totalBookings}</span>
          </div>
          <div className="self-stretch bg-[#E6DFC8] w-px" />
          <div className="flex flex-col items-center justify-center flex-1 gap-0.5">
            <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide opacity-60">Events</span>
            <span className="font-black text-[#1F1F1A] tabular-nums text-lg">{groups.length}</span>
          </div>
        </div>

        {/* Grouped list */}
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-white p-10 border border-[#E6DFC8] border-dashed rounded-2xl text-center">
            <div className="bg-[#F7F4EA] p-3 rounded-2xl">
              <Wallet className="w-6 h-6 text-[#5C4033] opacity-30" />
            </div>
            <p className="font-black text-[#1F1F1A] text-sm">Nothing outstanding</p>
            <p className="max-w-64 text-[#5F624F] text-[11px] leading-relaxed">
              Every confirmed booking on an active event is fully paid.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.eventId} className="bg-white border border-[#E6DFC8] rounded-2xl shadow-sm overflow-hidden">
                {/* Event header */}
                <Link
                  href={g.href}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[#E6DFC8] hover:bg-[#F7F4EA] transition-colors"
                >
                  <div className="flex flex-col justify-center items-center bg-[#F7F4EA] rounded-xl w-11 h-11 shrink-0">
                    <CalendarDays className="w-4 h-4 text-[#5C4033] opacity-60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      {g.subName && (
                        <span className={cn("px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wide", badgeClassFromColor(g.color))}>
                          {toTitleCase(g.subName)}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-[#1F1F1A] text-sm truncate leading-tight">{g.title}</p>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1 font-semibold text-[#5F624F] text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />{formatDate(g.date)}
                      </span>
                      {g.startTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatTime(g.startTime)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="font-black text-[#b45309] tabular-nums text-sm">£{g.outstanding.toFixed(2)}</span>
                    <span className="font-bold text-[#5F624F] text-[10px] uppercase tracking-wide opacity-60">owed</span>
                  </div>
                  <ChevronRight className="opacity-40 w-4 h-4 text-[#5F624F] shrink-0" />
                </Link>

                {/* Bookings */}
                <ul className="divide-y divide-[#E6DFC8]/60">
                  {g.bookings.map((bk) => (
                    <li key={bk.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1F1F1A] text-[13px] truncate">{bk.groupName}</p>
                        <div className="flex items-center gap-2.5 mt-0.5 font-semibold text-[#5F624F] text-[11px]">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />{bk.guests}
                          </span>
                          <span className="tabular-nums">
                            £{bk.paid.toFixed(2)} <span className="opacity-50">/ £{bk.total.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-[#b45309] tabular-nums text-[13px] shrink-0">
                        £{bk.outstanding.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
