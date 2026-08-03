"use client";

import React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { type EventSummary } from "./bookings-section";

export interface EventItem {
  id: string;
  date: string;
  title: string | null;
  start_time: string | null;
}

export interface PickerStats {
  bookings: number;
  guests: number;
}

const MICRO_LABEL = "font-black text-[10px] tracking-[0.12em] text-[#5E6654] uppercase";

const ALL_EVENTS = "all";

function optionLabel(event: EventItem) {
  return `${event.title || "Untitled event"} — ${format(parseISO(event.date), "eee d MMM")}`;
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#C9BB93] bg-white px-3.5 py-2.5">
      <span className={MICRO_LABEL}>{label}</span>
      <span className="font-black text-[15px] text-[#20231A] tabular-nums">{children}</span>
    </div>
  );
}

export default function EventPickerBanner({
  events,
  selectedEventId,
  todayIso,
  summary,
  stats,
  showPicker = true,
}: {
  events: EventItem[];
  selectedEventId: string | null;
  todayIso: string;
  summary: EventSummary | null;
  stats: PickerStats;
  showPicker?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const upcoming = events
    .filter(e => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events
    .filter(e => e.date < todayIso)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("bookingId");
    if (value === ALL_EVENTS) {
      params.delete("eventId");
      params.set("all", "1");
    } else {
      params.delete("all");
      params.set("eventId", value);
    }
    router.push(`?${params.toString()}`);
  };

  const hasPayments = !!summary && (summary.totalExpected > 0 || summary.totalPaid > 0);

  return (
    <section className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl border border-[#D8D5C8] border-l-[5px] border-l-[#34451F] bg-[#ECE4CE] px-5 py-4.5">
      <div className="min-w-0 flex-1">
        {showPicker ? (
          <label htmlFor="event-picker" className={cn(MICRO_LABEL, "mb-1.5 block")}>
            Step 1 · Choose which event to view
          </label>
        ) : (
          <span className={cn(MICRO_LABEL, "mb-1.5 block")}>Event</span>
        )}
        {showPicker ? (
          <div className="relative inline-block w-full max-w-full sm:w-auto">
            <select
              id="event-picker"
              value={selectedEventId ?? ALL_EVENTS}
              onChange={e => handleChange(e.target.value)}
              className="h-13 w-full appearance-none rounded-[13px] border-2 border-[#34451F] bg-white pr-11 pl-4 font-black text-sm tracking-wide text-[#20231A] uppercase outline-none focus:shadow-[0_0_0_3px_rgba(215,169,40,0.35)] sm:w-auto sm:min-w-85"
            >
              <option value={ALL_EVENTS}>All events — full history</option>
              {upcoming.length > 0 && (
                <optgroup label="Upcoming">
                  {upcoming.map(e => (
                    <option key={e.id} value={e.id}>
                      {optionLabel(e)}
                    </option>
                  ))}
                </optgroup>
              )}
              {past.length > 0 && (
                <optgroup label="Past">
                  {past.map(e => (
                    <option key={e.id} value={e.id}>
                      {optionLabel(e)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-[#34451F]" />
          </div>
        ) : (
          <h2 className="flex h-13 items-center font-black text-lg tracking-tight text-[#20231A] uppercase">
            {summary?.title || "Untitled event"}
          </h2>
        )}
        <p className="mt-2 text-xs font-bold text-[#5E6654]">
          {summary ? (
            <>
              {summary.dateLabel} · {summary.timeLabel} · Hosted by {summary.hostName} ·{" "}
              <span className={summary.isActive ? "text-[#2F6420]" : "text-[#96302A]"}>
                {summary.isActive ? "Active event" : "Inactive event"}
              </span>
            </>
          ) : (
            "Showing every booking across all events — pick one above to focus on it."
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-wrap gap-2.5">
          <Chip label="Bookings">{stats.bookings}</Chip>
          <Chip label="Guests">{stats.guests}</Chip>
          {summary?.seated && (
            <Chip label="Seated">
              {summary.seated.assigned}/{summary.seated.total}
            </Chip>
          )}
          {summary && hasPayments && (
            <Chip label="Paid">
              £{summary.totalPaid.toFixed(0)}{" "}
              <span className="text-xs text-[#5E6654]">of £{summary.totalExpected.toFixed(0)}</span>
            </Chip>
          )}
          {summary?.quiz && summary.quiz.status !== "Incomplete" && (
            <Chip label="Quiz">
              <span className={summary.quiz.status === "Complete" ? "text-[#2F6420]" : "text-[#5E6654]"}>
                {summary.quiz.status}
              </span>
              {summary.quiz.total > 0 && (
                <span className="text-xs text-[#5E6654]">
                  {" "}
                  {summary.quiz.count}/{summary.quiz.total}
                </span>
              )}
            </Chip>
          )}
        </div>
        {summary && showPicker && (
          <Link
            href={`/event-bookings/event/${summary.eventId}`}
            className="inline-flex h-9.5 items-center rounded-[11px] border border-[#D8D5C8] bg-white px-4 font-black text-[10.5px] tracking-widest text-[#5E6654] uppercase transition-colors hover:bg-[#ECE9DE]"
          >
            Manage event
          </Link>
        )}
      </div>
    </section>
  );
}
