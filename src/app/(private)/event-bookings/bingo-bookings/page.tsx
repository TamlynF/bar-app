import React, { Suspense } from "react";
import { getBingoBookings, getBingoEventList } from "./actions";
import { getAvailableTables, getEventDetails } from "../quiz-bookings/actions";
import BingoBookingListClient from "./bingo-list-client";
import QuizEventFilter from "../quiz-bookings/components/quiz-event-filter";
import {
  CalendarDays,
  Clock,
  User,
  ChevronDown,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatTime(t?: string | null): string {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export interface BingoBooking {
  id: string;
  event_id?: string;
  group_name?: string;
  group_size?: number;
  status?: string;
  payment_status?: string;
  paid_amount?: number;
  total_amount?: number;
  special_requests?: string;
  square_order_id?: string;
  booking_created_at?: string;
  contacts?: { full_name?: string; email?: string; country_code?: string; phone_no?: string };
  events?: { event_date?: string; event_title?: string; event_payment_amount?: number };
  booking_table_mappings?: { tables?: { tables_id?: string; tables_name?: string; tables_capacity?: number } }[];
}

export default async function BingoBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; eventId?: string; status?: string; payment_status?: string; from_date?: string; min_total?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date;
  const selectedEventId = params.eventId ?? null;
  const filterStatus = params.status;
  const filterPaymentStatus = params.payment_status;
  const filterFromDate = params.from_date;
  const filterMinTotal = params.min_total;

  const type = "games";
  const subType = "bingo";

  // 1. Fetch bingo events for the filter dropdown
  const bingoEventsRaw = await getBingoEventList(type, subType);
  const bingoEvents = bingoEventsRaw.map((e) => ({
    id: String(e.id),
    date: String(e.date),
    title: (e as { title?: string | null }).title ?? null,
  }));

  // 2. Fetch current bookings
  const allBookings = await getBingoBookings(selectedDate || null, selectedEventId, filterStatus ?? null, filterPaymentStatus ?? null, filterFromDate ?? null, filterMinTotal ?? null);
  const bingoBookings = allBookings as BingoBooking[];

  // 3. Fetch all physical tables
  const allTablesRaw = await getAvailableTables();
  const allTables = allTablesRaw || [];

  // 4. Fetch event details for selected date/event
  const eventDetails = selectedDate
    ? await getEventDetails(selectedDate, type, subType, selectedEventId)
    : null;

  // 5. Payment totals for selected event
  const activeBookings = bingoBookings.filter((b) => b.status !== "cancelled");
  const totalPaid = activeBookings.reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  const totalOutstanding = activeBookings.reduce(
    (sum, b) => sum + Math.max(0, (b.total_amount ?? 0) - (b.paid_amount ?? 0)),
    0
  );

  // 6. Table status by capacity
  let tableStatusByCapacity: { capacity: number; total: number; assigned: number }[] = [];

  if (selectedDate) {
    const groups: Record<number, { total: number; assigned: number }> = {};
    for (const t of allTables) {
      const cap = t.max_capacity || 0;
      if (!groups[cap]) groups[cap] = { total: 0, assigned: 0 };
      groups[cap].total++;
    }
    for (const b of bingoBookings) {
      for (const m of b.booking_table_mappings ?? []) {
        const cap = m.tables?.tables_capacity || 0;
        if (groups[cap]) groups[cap].assigned++;
      }
    }
    tableStatusByCapacity = Object.entries(groups)
      .map(([cap, v]) => ({ capacity: Number(cap), ...v }))
      .sort((a, b) => a.capacity - b.capacity);
  }

  return (
    <div className="flex-1 bg-background min-h-screen relative overflow-hidden">
      {/* Visual background blurs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-5 text-left">

        {/* Event filter dropdown */}
        <div className="w-full bg-white rounded-2xl border border-[#E6DFC8] shadow-sm p-1.5">
          <QuizEventFilter events={bingoEvents} selectedDate={selectedDate} />
        </div>

        {/* Event Summary / Empty State */}
        {selectedDate ? (
          <div className="bg-white rounded-2xl border border-[#E6DFC8] shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Main summary */}
            <div className="p-4 space-y-3">

              {/* sm+: Time · Host · Paid · Outstanding evenly spaced with labels */}
              <div className="hidden sm:flex items-start justify-evenly gap-4">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Time</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                    <span className="text-xs font-bold text-[#1F1F1A] whitespace-nowrap">
                      {formatTime(eventDetails?.start_time)} – {formatTime(eventDetails?.end_time)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Host</span>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                    <span className="text-xs font-bold text-[#1F1F1A]">
                      {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Paid</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black text-green-700 tabular-nums">£{totalPaid.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Outstanding</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black tabular-nums" style={{ color: totalOutstanding > 0 ? "#b45309" : "#5F624F" }}>
                      £{totalOutstanding.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider — sm+ only */}
              <div className="hidden sm:block border-t border-[#E6DFC8]" />

              {/* Table Status */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Table Status</span>
                <div className="flex flex-wrap gap-2">
                  {tableStatusByCapacity.length === 0 ? (
                    <span className="text-[11px] text-[#5F624F] opacity-60">No tables configured</span>
                  ) : (
                    tableStatusByCapacity.map((g) => (
                      <div
                        key={g.capacity}
                        className="flex flex-col items-center justify-center bg-[#F7F4EA] rounded-xl px-3 py-2 min-w-[56px]"
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#5F624F] opacity-60">
                          Cap {g.capacity}
                        </span>
                        <span className="text-base font-black text-[#1F1F1A] tabular-nums leading-tight">
                          {g.assigned}<span className="text-[#5F624F] opacity-50">/{g.total}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Expandable event details */}
            <details className="group border-t border-[#E6DFC8]">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F4EA] transition-colors list-none select-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">Event Details</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] opacity-60 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 space-y-2.5 border-t border-[#E6DFC8]/60">

                {/* Mobile-only: Time + Host + Paid + Outstanding */}
                <div className="sm:hidden space-y-2.5 pb-2.5 border-b border-[#E6DFC8]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                      <span className="text-xs font-bold text-[#1F1F1A] whitespace-nowrap">
                        {formatTime(eventDetails?.start_time)} – {formatTime(eventDetails?.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                      <span className="text-xs font-bold text-[#1F1F1A] truncate">
                        {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paid</span>
                      <span className="text-xs font-black text-green-700 tabular-nums">£{totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outstanding</span>
                      <span className="text-xs font-black tabular-nums" style={{ color: totalOutstanding > 0 ? "#b45309" : "#5F624F" }}>
                        £{totalOutstanding.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Title — all sizes */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Title</p>
                  <p className="text-sm font-bold text-[#1F1F1A]">{eventDetails?.title || "—"}</p>
                </div>

                {(eventDetails as { description?: string } | null)?.description && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Description</p>
                    <p className="text-xs text-[#5F624F] leading-relaxed">{(eventDetails as { description?: string }).description}</p>
                  </div>
                )}

                {(eventDetails as { payment_amount?: number } | null)?.payment_amount != null && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[#5F624F] opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entry</span>
                    <span className="text-sm font-black text-[#1F1F1A]">
                      £{(eventDetails as { payment_amount: number }).payment_amount.toFixed(2)}
                    </span>
                  </div>
                )}

                {!eventDetails && (
                  <p className="text-xs text-[#5F624F] opacity-60">No event record found for this date.</p>
                )}
              </div>
            </details>

          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
            <div className="p-3 bg-[#F7F4EA] rounded-2xl">
              <CalendarDays className="w-6 h-6 text-[#26300D] opacity-30" />
            </div>
            <p className="text-[10px] font-black uppercase text-[#5F624F] tracking-widest opacity-60 max-w-[200px] leading-relaxed">
              Select a date to see event details
            </p>
          </div>
        )}

        {/* Booking list */}
        <div className="space-y-3">
          <Suspense fallback={
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-[#E6DFC8]/40" />
              ))}
            </div>
          }>
            <BingoBookingListClient
              bookings={bingoBookings}
              selectedDate={selectedDate}
              filterStatus={filterStatus}
              filterPaymentStatus={filterPaymentStatus}
              filterFromDate={filterFromDate}
              filterMinTotal={filterMinTotal}
            />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
