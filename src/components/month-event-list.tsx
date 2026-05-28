"use client";

import { format, startOfWeek } from "date-fns";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

type MonthEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  externalLink: string | null;
  isFullyBooked: boolean;
  color: string;
  subType: string | null;
};

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Renders the current month's events. Upcoming events are grouped by ISO week
 * (Monday start) and always visible. Past events in the same month are tucked
 * behind a collapsed "earlier this month" toggle so the page leads with what's
 * actually coming up — the priority on a "what's on" screen.
 *
 * The next upcoming event is NOT highlighted here; it's promoted to the hero
 * card in page.tsx. This list is everything after it.
 */
export function MonthEventList({
  events,
  todayStr,
  nextEventId,
  monthLabel,
}: {
  events: MonthEvent[];
  todayStr: string;
  nextEventId: number | null;
  monthLabel: string;
}) {
  if (events.length === 0) return null;

  // Group ALL events (past + upcoming) by week
  const weeks = new Map<string, MonthEvent[]>();
  for (const ev of events) {
    const weekStart = startOfWeek(parseDate(ev.date), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const group = weeks.get(key) ?? [];
    group.push(ev);
    weeks.set(key, group);
  }

  return (
    <div className="space-y-5">
      <h2 className="text-white font-black text-2xl sm:text-4xl uppercase tracking-tighter leading-none text-center">
        {monthLabel}
      </h2>

      {Array.from(weeks.entries()).map(([weekKey, weekEvents]) => {
        const weekStart = parseDate(weekKey);
        const weekEndDate = new Date(weekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const label = `${format(weekStart, "d")} – ${format(weekEndDate, "d MMM")}`;

        return (
          <div key={weekKey}>
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-500">
                {label}
              </span>
              <div className="flex-1 h-px bg-stone-800/50" />
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl divide-y divide-white/5 overflow-hidden">
              {weekEvents.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  isPast={ev.date < todayStr}
                  isNext={ev.id === nextEventId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ event, isPast, isNext = false }: { event: MonthEvent; isPast: boolean; isNext?: boolean }) {
  const dateObj = parseDate(event.date);

  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-4 transition-colors ${
        isPast
          ? "opacity-50"
          : isNext
            ? "bg-[#FDCC4B]/5 border-l-2 border-l-[#FDCC4B]"
            : "hover:bg-white/[0.04]"
      }`}
    >
      {/* Type colour dot */}
      <span
        className="ev-dot shrink-0 w-2 h-2 rounded-full"
        style={{ "--ev-c": event.color } as React.CSSProperties}
      />

      {/* Date */}
      <div className="shrink-0 w-12">
        <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest leading-tight">
          {format(dateObj, "EEE")}
        </p>
        <p className="text-white text-base font-black tabular-nums leading-none">
          {format(dateObj, "d")}
        </p>
      </div>

      {/* Title + sub-type + time */}
      <div className="flex-1 min-w-0">
        <p
          className={`ev-text text-sm font-black leading-tight truncate ${
            isPast ? "line-through" : ""
          }`}
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {event.subType && (
            <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wide truncate">
              {event.subType}
            </span>
          )}
          {event.startTimeLabel && (
            <span className="text-stone-400 text-xs font-bold tabular-nums shrink-0">
              {event.startTimeLabel}{event.endTimeLabel ? ` - ${event.endTimeLabel}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Trailing marker */}
      {!isPast && isNext && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-[#1a2008] bg-[#FDCC4B] px-2.5 py-1 rounded-full">
          Next
        </span>
      )}
      {!isPast && !isNext && event.isFullyBooked && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
          Sold Out
        </span>
      )}
      {!isPast && !event.isFullyBooked && event.externalLink && (
        <ExternalLink className="w-3.5 h-3.5 text-stone-600 shrink-0" />
      )}
    </div>
  );

  if (isPast) {
    return (
      <button
        type="button"
        className="w-full text-left"
        onClick={() => toast("This event has already happened")}
      >
        {inner}
      </button>
    );
  }

  if (event.externalLink) {
    return (
      <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return inner;
}