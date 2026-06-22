"use client";

import React, { useState, useMemo } from "react";
import { CalendarDays, Clock, User, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import BookingList, { type GeneralBooking } from "./booking-list";

// Mirrors statusTheme in quiz-bookings/components/booking-list-client.tsx so the
// stats bar reads consistently across booking surfaces.
const STAT_THEME: Record<string, { border: string; text: string; dot: string; ring: string }> = {
  all:        { border: "border-[#E6DFC8]",  text: "text-[#1F1F1A]",  dot: "bg-[#5F624F]", ring: "ring-slate-500/30" },
  confirmed:  { border: "border-green-200",  text: "text-green-700",  dot: "bg-green-500", ring: "ring-green-500/30" },
  waitlisted: { border: "border-orange-200", text: "text-orange-700", dot: "bg-orange-500", ring: "ring-orange-500/30" },
  pending:    { border: "border-yellow-200", text: "text-amber-700",  dot: "bg-amber-500", ring: "ring-yellow-500/30" },
  cancelled:  { border: "border-red-200",    text: "text-red-700",    dot: "bg-red-500",   ring: "ring-red-500/30" },
};

export interface EventSummary {
  dateLabel: string;
  timeLabel: string;
  hostName: string;
  badgeClass: string | null;
  badgeLabel: string | null;
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
        <div className="bg-amber-50 rounded-2xl border border-[#E6DFC8] shadow-sm p-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
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
              {/* Type badge */}
              {summary.badgeClass && summary.badgeLabel && (
                <div className="ml-auto self-start">
                  <span className={cn("text-[9px] font-black uppercase tracking-wide px-2.5 py-1 rounded-md", summary.badgeClass)}>
                    {summary.badgeLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
      )}

      {/* Stats + Search grouped card — always shown, with or without an event selected */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center">

              {/* Stats Bar — scrolls on mobile, evenly spaced on sm+ */}
              <div className="overflow-x-auto no-scrollbar px-1 pt-2 sm:flex-1 sm:pt-0">
                <div className="flex items-stretch gap-2 w-full px-1 py-3 min-w-max sm:min-w-0 sm:justify-evenly sm:gap-0">
                  {bookingStats.map(s => {
                    const theme = STAT_THEME[s.key];
                    const isActive = s.key === "all"
                      ? activeStatusFilters.size === 0
                      : activeStatusFilters.has(s.key);
                    return (
                      <div key={s.key} className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
                        <button
                          type="button"
                          aria-pressed={isActive}
                          aria-label={`Filter by ${s.label}`}
                          onClick={() => s.key === "all"
                            ? setActiveStatusFilters(new Set())
                            : toggleStatusFilter(s.key)}
                          className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all touch-manipulation hover:scale-105 active:scale-95",
                            isActive ? cn(theme.dot, theme.border, "shadow-lg ring-4", theme.ring) : cn("bg-white", theme.border)
                          )}
                        >
                          <span className={cn("text-sm font-black leading-none tabular-nums", isActive ? "text-white" : theme.text)}>
                            {s.list.length}
                          </span>
                        </button>
                        <div className="flex flex-col items-center leading-none">
                          <span className={cn("text-[10px] sm:text-[11px] font-black uppercase tracking-tight", isActive ? theme.text : "text-[#5F624F]")}>
                            {s.label}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-[#5F624F] uppercase mt-0.5 tabular-nums">
                            {sumGuests(s.list)} Guests
                          </span>
                        </div>
                      </div>
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
