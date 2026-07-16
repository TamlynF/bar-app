import React, { Suspense } from "react";
import { getBookings, getAvailableTables, getQuizEvents, getEventDetails, getQuizStatusStats } from "./actions";
import BookingListClient from "./components/booking-list-client";
import QuizEventFilter from "./components/quiz-event-filter";
import {
  CheckCircle2,
  Info,
  CalendarDays,
  Clock,
  User,
  AlertCircle,
  ChevronDown,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableRow {
  tables_id: string;
  tables_name?: string;
  tables_capacity?: number;
  tables_description?: string;
  tables_available?: boolean;
}

export interface ScoreRow {
  score: number;
  is_winner: boolean;
}

export interface EventType {
  category?: string;
}

export interface EventSubtype {
  sub_type?: string;
}

export interface EventRow {
  event_date?: string;
  event_start_time?: string;
  event_end_time?: string;
  event_title?: string;
  event_description?: string;
  event_payment_amount?: number;
  event_types?: EventType;
  event_subtypes?: EventSubtype;
}

export interface ContactRow {
  full_name?: string;
  email?: string;
  country_code?: string;
  phone_no?: string;
}

export interface Booking {
  id: string;
  event_id?: string;
  group_name?: string;
  team_id?: string;
  contact_id?: string;
  group_size?: number;
  paid_amount?: number;
  status?: string;
  special_requests?: string;
  booking_created_at?: string;
  contacts?: ContactRow;
  events?: EventRow;
  booking_table_mappings?: {
    tables?: TableRow;
  }[];
  booking_scores?: ScoreRow[];
  updated_at?: string | null;
  updated_by?: number | null;
  updated_by_employee?: { full_name: string; role: string | null } | null;
  updated_by_contact_id?: number | null;
  updated_by_contact?: { full_name: string } | null;
}

export const dynamic = 'force-dynamic';

function formatTime(t?: string | null): string {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

export default async function QuizBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; eventId?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date;
  const selectedEventId = params.eventId ?? null;

  const type = "games";
  const subType = "quiz";

  // 1. Fetch quiz events for the filter dropdown
  const quizEventsRaw = await getQuizEvents(type, subType);
  const quizEvents = (quizEventsRaw ?? []).map((e) => ({
    id: String(e.id),
    date: String(e.date),
    title: e.title ?? null,
  }));

  // 2. Fetch current bookings
  const allBookings = await getBookings(type, subType, selectedDate || null, selectedEventId);
  const quizBookings = (allBookings as unknown as Booking[]) ?? [];

  // 3. Fetch all physical tables
  const allTablesRaw = await getAvailableTables();
  const allTables = allTablesRaw || [];

  // 4. Fetch event details + quiz stats for selected date
  const eventDetails = selectedDate
    ? await getEventDetails(selectedDate, type, subType, selectedEventId)
    : null;

  const quizStats = eventDetails
    ? await getQuizStatusStats(Number(eventDetails.id))
    : null;

  // 5. Derive quiz status
  const quizStatus =
    !quizStats || quizStats.categoryTotal === 0
      ? "Not Started"
      : quizStats.questionCount >= quizStats.categoryTotal
      ? "Complete"
      : quizStats.questionCount > 0
      ? "Incomplete"
      : "Not Started";

  // 6. Table status by capacity
  let tableStatusByCapacity: { capacity: number; total: number; assigned: number }[] = [];

  if (selectedDate) {
    const groups: Record<number, { total: number; assigned: number }> = {};
    for (const t of allTables) {
      const cap = t.max_capacity || 0;
      if (!groups[cap]) groups[cap] = { total: 0, assigned: 0 };
      groups[cap].total++;
    }
    for (const b of quizBookings) {
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
      {/* Visual background blurs */}
      <div className="pointer-events-none fixed top-0 right-0 -z-10 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-80 w-80 rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="mx-auto max-w-7xl space-y-5 px-3 py-3 text-left sm:py-0 md:px-8">

        {/* Full-width Event Selection Section */}
        <div className="w-full rounded-2xl border border-[#E6DFC8] bg-white p-1.5 shadow-sm">
          <QuizEventFilter events={quizEvents} selectedDate={selectedDate} />
        </div>

        {/* Event Summary / Empty State */}
        {selectedDate ? (
          <div className="animate-in overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white shadow-sm duration-500 fade-in slide-in-from-top-2">

            {/* Main summary */}
            <div className="space-y-3 p-4">

              {/* sm+: Time · Host · Quiz Status — evenly spaced with labels */}
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
                      {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none font-bold tracking-wide text-[#5F624F]/50 uppercase">Quiz Status</span>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase",
                    quizStatus === "Complete"    && "bg-green-100 text-green-700",
                    quizStatus === "Incomplete"  && "bg-orange-100 text-orange-700",
                    quizStatus === "Not Started" && "bg-[#F7F4EA] text-[#5F624F]",
                  )}>
                    {quizStatus === "Complete"    && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {quizStatus === "Incomplete"  && <AlertCircle  className="h-3.5 w-3.5" />}
                    {quizStatus === "Not Started" && <Info         className="h-3.5 w-3.5" />}
                    <span>{quizStatus}</span>
                    {quizStats && quizStats.categoryTotal > 0 && (
                      <span className="font-bold tracking-normal normal-case opacity-60">
                        ({quizStats.questionCount}/{quizStats.categoryTotal})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider — only needed on sm+ where content sits above Table Status */}
              <div className="hidden border-t border-[#E6DFC8] sm:block" />

              {/* Table Status */}
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
                        <span className="text-[9px] font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
                          Cap {g.capacity}
                        </span>
                        <span className="text-base leading-tight font-bold text-[#1F1F1A] tabular-nums">
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
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors select-none hover:bg-[#F7F4EA]">
                <span className="text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">Event Details</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#5F624F] opacity-60 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2.5 border-t border-[#E6DFC8]/60 px-4 pb-4">

                {/* Mobile-only: Time, Host, Quiz Status */}
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
                        {(eventDetails?.host as { full_name?: string } | null)?.full_name ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase",
                    quizStatus === "Complete"    && "bg-green-100 text-green-700",
                    quizStatus === "Incomplete"  && "bg-orange-100 text-orange-700",
                    quizStatus === "Not Started" && "bg-[#F7F4EA] text-[#5F624F]",
                  )}>
                    {quizStatus === "Complete"    && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {quizStatus === "Incomplete"  && <AlertCircle  className="h-3.5 w-3.5" />}
                    {quizStatus === "Not Started" && <Info         className="h-3.5 w-3.5" />}
                    <span>{quizStatus}</span>
                    {quizStats && quizStats.categoryTotal > 0 && (
                      <span className="font-bold tracking-normal normal-case opacity-60">
                        ({quizStats.questionCount}/{quizStats.categoryTotal})
                      </span>
                    )}
                  </div>
                </div>

                {/* Title — all screen sizes */}
                <div>
                  <p className="mb-0.5 text-[10px] font-bold tracking-wide text-[#5F624F]/50 uppercase">Title</p>
                  <p className="text-sm font-bold text-[#1F1F1A]">{eventDetails?.title || "—"}</p>
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
                    <span className="text-sm font-bold text-[#1F1F1A]">
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
            <p className="max-w-50 text-[10px] leading-relaxed font-bold tracking-wide text-[#5F624F] uppercase opacity-60">
              Select a date to see event details
            </p>
          </div>
        )}

        {/* Main List Section */}
        <div className="space-y-3">
          <Suspense fallback={
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#E6DFC8]/40 bg-white" />
              ))}
            </div>
          }>
            <BookingListClient
              initialBookings={quizBookings}
              selectedDate={selectedDate}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
