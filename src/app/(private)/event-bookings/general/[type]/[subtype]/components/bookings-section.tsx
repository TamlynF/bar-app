"use client";

import React, { useState, useMemo } from "react";
import { CalendarDays, Clock, User, Search, X, CheckCircle2, AlertCircle, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import BookingList, { type GeneralBooking } from "./booking-list";
import StatusCircle from "@/components/editorial/status-circle";

export interface EventSummary {
  title: string;
  isActive: boolean;
  dateLabel: string;
  timeLabel: string;
  hostName: string;
  badgeClass: string | null;
  badgeLabel: string | null;
  /** Per-person price (null when the event is free) — drives the payment rows. */
  paymentAmount: number | null;
  /** Sum of expected booking totals (non-cancelled). */
  totalExpected: number;
  /** Sum of amounts actually paid (non-cancelled). */
  totalPaid: number;
  /** Present only for quiz-behaviour sub-categories. */
  quiz?: { status: string; count: number; total: number } | null;
  /** Present only when the event requires seating — capacity buckets. */
  tableStats?: { capacity: number; total: number; assigned: number }[] | null;
}

const sumGuests = (list: GeneralBooking[]) =>
  list.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0);

export default function BookingsSection({
  bookings,
  summary,
  type,
  subtype,
}: {
  bookings: GeneralBooking[];
  /** Present when an event is selected — enables the interactive stats bar. */
  summary: EventSummary | null;
  type: string;
  subtype: string;
}) {
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleStatusFilter = (status: string) => {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const bookingStats = [
    { key: "all",        label: "Total",      list: bookings },
    { key: "confirmed",  label: "Confirmed",  list: bookings.filter(b => b.status === "confirmed") },
    { key: "waitlisted", label: "Waitlisted", list: bookings.filter(b => b.status === "waitlisted") },
    { key: "pending",    label: "Pending",    list: bookings.filter(b => b.status === "pending") },
    { key: "cancelled",  label: "Cancelled",  list: bookings.filter(b => b.status === "cancelled") },
  ];

  // Status (multi-select) + search filtering driven by the stats/search card,
  // which is always shown (with or without an event selected).
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchesStatus =
        activeStatusFilters.size === 0
          ? true
          : activeStatusFilters.has((b.status || "").toLowerCase());
      return (
        matchesStatus &&
        (q === "" ||
          (b.group_name || "").toLowerCase().includes(q) ||
          (b.contacts?.full_name || "").toLowerCase().includes(q))
      );
    });
  }, [bookings, activeStatusFilters, searchQuery]);
  
  return (
    <>
      {/* Event info — only when an event is selected */}
      {summary && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">

          {/* Event details (collapsible) */}
          <details open className="group bg-amber-50 rounded-2xl border border-[#E6DFC8] shadow-sm overflow-hidden">
            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-amber-100/40 transition-colors list-none select-none">
              <span className="text-sm font-black text-[#1F1F1A] truncate min-w-0">{summary.title || "Untitled Event"}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md border",
                  summary.isActive ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-600 border-red-300",
                )}>
                  {summary.isActive ? "Active" : "Inactive"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] opacity-60 transition-transform group-open:rotate-180" />
              </div>
            </summary>

            <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 pb-4 pt-3 border-t border-[#E6DFC8] bg-white">
              {/* Date */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Date</span>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">{summary.dateLabel}</span>
                </div>
              </div>
              {/* Time */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Time</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">{summary.timeLabel}</span>
                </div>
              </div>
              {/* Host */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Host</span>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5F624F] opacity-50 shrink-0" />
                  <span className="text-xs font-bold text-[#1F1F1A]">{summary.hostName}</span>
                </div>
              </div>
              {/* Payments — full-width row under Date / Time / Host, paid events only */}
              {summary.paymentAmount != null && summary.paymentAmount !== 0 && (
                <div className="basis-full flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Payments</span>
                  <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Per Person</span>
                      <span className="text-xs font-bold text-[#1F1F1A]">£{summary.paymentAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Expected</span>
                      <span className="text-xs font-bold text-[#1F1F1A]">£{summary.totalExpected.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Paid</span>
                      <span className="text-xs font-bold text-green-700">£{summary.totalPaid.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Quiz Status — only for quiz-behaviour sub-categories */}
              {summary.quiz && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]/50 leading-none">Quiz Status</span>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide",
                    summary.quiz.status === "Complete"    && "bg-green-100 text-green-700",
                    summary.quiz.status === "Incomplete"  && "bg-orange-100 text-orange-700",
                    summary.quiz.status === "Not Started" && "bg-[#F7F4EA] text-[#5F624F]",
                  )}>
                    {summary.quiz.status === "Complete"    && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {summary.quiz.status === "Incomplete"  && <AlertCircle  className="w-3.5 h-3.5" />}
                    {summary.quiz.status === "Not Started" && <Info         className="w-3.5 h-3.5" />}
                    <span>{summary.quiz.status}</span>
                    {summary.quiz.total > 0 && (
                      <span className="opacity-60 font-bold normal-case tracking-normal">
                        ({summary.quiz.count}/{summary.quiz.total})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* Table status (collapsible) — only when the event requires seating */}
          {summary.tableStats && summary.tableStats.length > 0 && (
            <details open className="group bg-white rounded-2xl border border-[#E6DFC8] shadow-sm overflow-hidden">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-[#F7F4EA] transition-colors list-none select-none">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Table Status</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#5F624F] opacity-60 transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3 border-t border-[#E6DFC8]">
                {summary.tableStats.map((g) => (
                  <div
                    key={g.capacity}
                    className="flex flex-col items-center justify-center bg-[#F7F4EA] rounded-xl px-3 py-2 min-w-14"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F] opacity-60">
                      Cap {g.capacity}
                    </span>
                    <span className="text-base font-bold text-[#1F1F1A] tabular-nums leading-tight">
                      {g.assigned}<span className="text-[#5F624F] opacity-50">/{g.total}</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Stats + Search grouped card — always shown, with or without an event selected */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center">

              {/* Stats Bar — scrolls on mobile, evenly spaced on sm+ */}
              <div className="overflow-x-auto no-scrollbar px-1 pt-2 sm:flex-1 sm:pt-0">
                <div className="flex items-stretch gap-3 w-full px-2 py-3 min-w-max sm:min-w-0 sm:justify-evenly sm:gap-0">
                  {bookingStats.map(s => {
                    const isActive = s.key === "all"
                      ? activeStatusFilters.size === 0
                      : activeStatusFilters.has(s.key);
                    return (
                      <StatusCircle
                        key={s.key}
                        status={s.key}
                        label={s.label}
                        teamCount={s.list.length}
                        guestCount={sumGuests(s.list)}
                        unit="bookings"
                        isActive={isActive}
                        onClick={() => s.key === "all"
                          ? setActiveStatusFilters(new Set())
                          : toggleStatusFilter(s.key)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Divider: horizontal on mobile, vertical on sm+ */}
              <div className="border-t border-[#E6DFC8] mx-3 sm:hidden" />
              <div className="hidden sm:block w-px bg-[#E6DFC8] sm:self-stretch sm:my-2" />

              {/* Search */}
              <div className="flex justify-center px-4 mb-3 sm:mb-0 sm:py-2 sm:px-3 sm:shrink-0">
                <div className="flex items-center gap-3 h-10 px-4 w-full max-w-sm sm:w-56 rounded-xl border border-[#E6DFC8] focus-within:border-[#5C4033] transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search names or guests..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                    />
                  </div>
                  {(activeStatusFilters.size > 0 || searchQuery.length > 0) && (
                    <button
                      type="button"
                      title="Clear filters"
                      onClick={() => { setActiveStatusFilters(new Set()); setSearchQuery(""); }}
                      className="shrink-0 p-1 rounded-lg hover:bg-[#E6DFC8] transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

      {/* Bookings list — filtered by the stats bar + search */}
      <div className="space-y-3">
        <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          Bookings ({filteredBookings.length})
        </span>
        <BookingList bookings={filteredBookings} activeStatus="all" showDate={!summary} type={type} subtype={subtype} />
      </div>
    </>
  );
}
