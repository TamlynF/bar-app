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

export const dynamic = "force-dynamic";

function formatTime(t?: string | null): string {
  if (!t) return "-";
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

  const bingoEventsRaw = await getBingoEventList();
  const bingoEvents = bingoEventsRaw.map((e) => ({
    id: String(e.id),
    date: String(e.date),
    title: (e as { title?: string | null }).title ?? null,
  }));

  const allBookings = await getBingoBookings(selectedDate || null, selectedEventId, filterStatus ?? null, filterPaymentStatus ?? null, filterFromDate ?? null, filterMinTotal ?? null);
  const bingoBookings = allBookings as BingoBooking[];

  const allTablesRaw = await getAvailableTables();
  const allTables = allTablesRaw || [];

  const eventDetails = selectedDate
    ? await getEventDetails(selectedDate, type, subType, selectedEventId)
    : null;

  const activeBookings = bingoBookings.filter((b) => b.status !== "cancelled");
  const totalPaid = activeBookings.reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  const totalOutstanding = activeBookings.reduce(
    (sum, b) => sum + Math.max(0, (b.total_amount ?? 0) - (b.paid_amount ?? 0)),
    0
  );

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
    <div className="relative min-h-screen flex-1 overflow-hidden bg-background">
      <div className="pointer-events-none fixed top-0 right-0 -z-10 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-80 w-80 rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="mx-auto max-w-7xl space-y-5 px-3 py-3 text-left sm:py-0 md:px-8">

        <div className="w-full rounded-2xl border border-[#E6DFC8] bg-white p-1.5 shadow-sm">
          <QuizEventFilter events={bingoEvents} selectedDate={selectedDate} />
        </div>

        {selectedDate ? (
          <div className="animate-in overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white shadow-sm duration-500 fade-in slide-in-from-top-2">

            <div className="space-y-3 p-4">

              <div className="hidden items-start justify-evenly gap-4 sm:flex">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Time</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#5F624F] opacity-50" />
                    <span className="text-xs font-bold whitespace-nowrap text-[#1F1F1A]">
                      {formatTime(eventDetails?.start_time)} – {formatTime(eventDetails?.end_time)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Host</span>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0 text-[#5F624F] opacity-50" />
                    <span className="text-xs font-bold text-[#1F1F1A]">
                      {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "-"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Paid</span>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-xs text-green-700 tabular-nums">£{totalPaid.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Outstanding</span>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-xs tabular-nums" style={{ color: totalOutstanding > 0 ? "#b45309" : "#5F624F" }}>
                      £{totalOutstanding.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden border-t border-[#E6DFC8] sm:block" />

              <div className="flex flex-col gap-2">
                <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Table Status</span>
                <div className="flex flex-wrap gap-2">
                  {tableStatusByCapacity.length === 0 ? (
                    <span className="text-[11px] text-[#5F624F] opacity-60">No tables configured</span>
                  ) : (
                    tableStatusByCapacity.map((g) => (
                      <div
                        key={g.capacity}
                        className="flex min-w-14 flex-col items-center justify-center rounded-xl bg-[#F7F4EA] px-3 py-2"
                      >
                        <span className="font-black text-[9px] tracking-wide text-[#5F624F] uppercase opacity-60">
                          Cap {g.capacity}
                        </span>
                        <span className="font-black text-base leading-tight text-[#1F1F1A] tabular-nums">
                          {g.assigned}<span className="text-[#5F624F] opacity-50">/{g.total}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            <details className="group border-t border-[#E6DFC8]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors select-none hover:bg-[#F7F4EA]">
                <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Event Details</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#5F624F] opacity-60 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2.5 border-t border-[#E6DFC8]/60 px-4 pb-4">

                <div className="space-y-2.5 border-b border-[#E6DFC8] pb-2.5 sm:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#5F624F] opacity-50" />
                      <span className="text-xs font-bold whitespace-nowrap text-[#1F1F1A]">
                        {formatTime(eventDetails?.start_time)} – {formatTime(eventDetails?.end_time)}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-[#5F624F] opacity-50" />
                      <span className="truncate text-xs font-bold text-[#1F1F1A]">
                        {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Paid</span>
                      <span className="font-black text-xs text-green-700 tabular-nums">£{totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Outstanding</span>
                      <span className="font-black text-xs tabular-nums" style={{ color: totalOutstanding > 0 ? "#b45309" : "#5F624F" }}>
                        £{totalOutstanding.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-0.5 text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Title</p>
                  <p className="text-sm font-bold text-[#1F1F1A]">{eventDetails?.title || "-"}</p>
                </div>

                {(eventDetails as { description?: string } | null)?.description && (
                  <div>
                    <p className="mb-0.5 text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Description</p>
                    <p className="text-xs leading-relaxed text-[#5F624F]">{(eventDetails as { description?: string }).description}</p>
                  </div>
                )}

                {(eventDetails as { payment_amount?: number } | null)?.payment_amount != null && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-[#5F624F] opacity-50" />
                    <span className="text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Entry</span>
                    <span className="font-black text-sm text-[#1F1F1A]">
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
          <div className="flex flex-col items-center justify-center gap-3 rounded-4xl border-2 border-dashed border-[#E6DFC8] bg-white p-6 text-center shadow-sm">
            <div className="rounded-2xl bg-[#F7F4EA] p-3">
              <CalendarDays className="h-6 w-6 text-[#5C4033] opacity-30" />
            </div>
            <p className="max-w-50 font-black text-[10px] leading-relaxed tracking-wide text-[#5F624F] uppercase opacity-60">
              Select a date to see event details
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Suspense fallback={
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#E6DFC8]/40 bg-white" />
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
