"use client";

import React, { useState } from "react";
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

const FIELD_LABEL = "text-[11px] font-semibold text-[#5E6654]";

const ALL_EVENTS = "all";

function optionLabel(event: EventItem) {
  return `${event.title || "Untitled event"} — ${format(parseISO(event.date), "eee d MMM")}`;
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#C9BB93] bg-white px-3.5 py-2.5">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="text-[15px] font-bold text-[#20231A] tabular-nums">{children}</span>
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
  const [detailsOpen, setDetailsOpen] = useState(true);

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
  const showQuiz = !!summary?.quiz && summary.quiz.status !== "Incomplete";

  const compactStats = [
    `${stats.bookings} ${stats.bookings === 1 ? "booking" : "bookings"}`,
    `${stats.guests} ${stats.guests === 1 ? "guest" : "guests"}`,
    summary?.seated ? `${summary.seated.assigned}/${summary.seated.total} seated` : null,
    summary && hasPayments
      ? `£${summary.totalPaid.toFixed(0)} of £${summary.totalExpected.toFixed(0)} paid`
      : null,
    showQuiz && summary?.quiz
      ? `Quiz ${summary.quiz.status.toLowerCase()}${summary.quiz.total > 0 ? ` ${summary.quiz.count}/${summary.quiz.total}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-wrap items-end gap-x-6 gap-y-2.5 rounded-2xl border border-[#D8D5C8] border-l-[5px] border-l-[#34451F] bg-[#ECE4CE] px-3.5 py-3.5 max-sm:-mx-3 sm:gap-y-4 sm:px-5 sm:py-4.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 sm:mb-1.5">
          {showPicker ? (
            <label htmlFor="event-picker" className={FIELD_LABEL}>
              Step 1 · Choose which event to view
            </label>
          ) : (
            <span className={FIELD_LABEL}>Event</span>
          )}
          <button
            type="button"
            onClick={() => setDetailsOpen(open => !open)}
            aria-expanded={detailsOpen}
            aria-controls="event-banner-details"
            aria-label={detailsOpen ? "Hide event details" : "Show event details"}
            className="-my-2 -mr-1.5 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#5E6654] transition-colors hover:bg-black/5 sm:my-0 sm:h-8 sm:w-8"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
          </button>
        </div>
        {showPicker ? (
          <div className="relative inline-block w-full max-w-full sm:w-auto">
            <select
              id="event-picker"
              value={selectedEventId ?? ALL_EVENTS}
              onChange={e => handleChange(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border-2 border-[#34451F] bg-white pr-11 pl-3.5 text-sm font-semibold text-[#20231A] outline-none focus:shadow-[0_0_0_3px_rgba(215,169,40,0.35)] sm:h-13 sm:w-auto sm:min-w-85 sm:rounded-[13px] sm:pl-4"
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
          <h2 className="flex min-h-11 items-center text-lg leading-tight font-bold tracking-tight text-[#20231A] sm:h-13">
            {summary?.title || "Untitled event"}
          </h2>
        )}
        {detailsOpen && (
          <div id="event-banner-details">
            <p className="mt-1.5 text-[13px] leading-snug font-medium text-[#5E6654] sm:mt-2">
              {summary ? (
                <>
                  {summary.dateLabel} · {summary.timeLabel}
                  <span className="max-sm:hidden"> · Hosted by {summary.hostName}</span> ·{" "}
                  <span className={cn("font-bold", summary.isActive ? "text-[#2F6420]" : "text-[#96302A]")}>
                    {summary.isActive ? "Active" : "Inactive"}
                  </span>
                </>
              ) : (
                "Showing every booking across all events — pick one above to focus on it."
              )}
            </p>
            <p className="mt-1 text-[13px] leading-snug font-medium text-[#5E6654] tabular-nums sm:hidden">
              {compactStats}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex w-full flex-wrap items-end gap-2 sm:w-auto sm:gap-2.5",
          !detailsOpen && "hidden",
          !(summary && showPicker) && "max-sm:hidden",
        )}
      >
        <div className="hidden flex-wrap gap-2 sm:flex sm:gap-2.5">
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
              <span className="text-[13px] font-medium text-[#5E6654]">
                of £{summary.totalExpected.toFixed(0)}
              </span>
            </Chip>
          )}
          {showQuiz && summary?.quiz && (
            <Chip label="Quiz">
              <span className={summary.quiz.status === "Complete" ? "text-[#2F6420]" : "text-[#5E6654]"}>
                {summary.quiz.status}
              </span>
              {summary.quiz.total > 0 && (
                <span className="text-[13px] font-medium text-[#5E6654]">
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
            className="inline-flex h-11 items-center justify-center rounded-[11px] border border-[#D8D5C8] bg-white px-4 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] max-sm:w-full sm:h-9.5"
          >
            Manage event
          </Link>
        )}
      </div>
    </section>
  );
}
