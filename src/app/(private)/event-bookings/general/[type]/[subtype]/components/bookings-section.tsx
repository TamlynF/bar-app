"use client";

import React, { useState } from "react";
import { CalendarDays, Clock, User } from "lucide-react";
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
}: {
  bookings: GeneralBooking[];
  /** Present when an event is selected — enables the interactive stats bar. */
  summary: EventSummary | null;
}) {
  const [activeStatus, setActiveStatus] = useState("all");

  const bookingStats = [
    { key: "all",        label: "Total",      list: bookings },
    { key: "confirmed",  label: "Confirmed",  list: bookings.filter(b => b.status === "confirmed") },
    { key: "waitlisted", label: "Waitlisted", list: bookings.filter(b => b.status === "waitlisted") },
    { key: "pending",    label: "Pending",    list: bookings.filter(b => b.status === "pending") },
    { key: "cancelled",  label: "Cancelled",  list: bookings.filter(b => b.status === "cancelled") },
  ];

  return (
    <>
      {summary ? (
        <div className="bg-amber-50 rounded-2xl border border-[#E6DFC8] shadow-sm p-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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

          {/* Booking counts — interactive stats bar */}
          <div className="overflow-x-auto no-scrollbar pt-2 border-t border-[#E6DFC8]">
            <div className="flex items-stretch gap-3 py-1 min-w-max sm:min-w-0 sm:justify-evenly sm:gap-0">
              {bookingStats.map(s => {
                const theme = STAT_THEME[s.key];
                const isActive = activeStatus === s.key;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`Filter by ${s.label}`}
                      onClick={() => setActiveStatus(prev => (prev === s.key ? "all" : s.key))}
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
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-[#E6DFC8] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center gap-3 shadow-sm">
          <div className="p-3 bg-[#F7F4EA] rounded-2xl">
            <CalendarDays className="w-6 h-6 text-[#5C4033] opacity-30" />
          </div>
          <p className="text-[10px] font-bold uppercase text-[#5F624F] tracking-wide opacity-60 max-w-[200px] leading-relaxed">
            Select an event above to filter by date
          </p>
        </div>
      )}

      {/* Bookings list — filter controlled by the stats bar when an event is selected */}
      <div className="space-y-3">
        <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          Bookings ({bookings.length})
        </span>
        <BookingList bookings={bookings} activeStatus={summary ? activeStatus : undefined} />
      </div>
    </>
  );
}
