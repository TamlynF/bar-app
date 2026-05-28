"use client";

import { format, startOfWeek } from "date-fns";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

type MonthEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  externalLink: string | null;
  color: string;
  subType: string | null;
};

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Groups events by ISO week (Monday start) and renders them in a single
 * unified month list. Past events are muted; the next upcoming event is
 * highlighted.
 */
export function MonthEventList({
  events,
  todayStr,
  nextEventId,
}: {
  events: MonthEvent[];
  todayStr: string;
  nextEventId: number | null;
}) {
  if (events.length === 0) return null;

  // Group events by week start date
  const weeks = new Map<string, MonthEvent[]>();
  for (const ev of events) {
    const weekStart = startOfWeek(parseDate(ev.date), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const group = weeks.get(key) ?? [];
    group.push(ev);
    weeks.set(key, group);
  }

  return (
    <div className="space-y-6">
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
              {weekEvents.map((ev) => {
                const isPast = ev.date < todayStr;
                const isNext = ev.id === nextEventId;

                return (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    isPast={isPast}
                    isNext={isNext}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  event,
  isPast,
  isNext,
}: {
  event: MonthEvent;
  isPast: boolean;
  isNext: boolean;
}) {
  const dateObj = parseDate(event.date);
  console.log("Rendering event", { title: event.title, color: event.color, date: event.date, isPast, isNext });
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isPast
          ? "opacity-40"
          : isNext
            ? "bg-[#FDCC4B]/5 border-l-2 border-l-[#FDCC4B]"
            : "hover:bg-white/[0.03]"
      }`}
    >
      <span
        className="ev-dot shrink-0 w-2 h-2 rounded-full"
        style={{ "--ev-c": event.color } as React.CSSProperties}
      />
      <div className="shrink-0 w-14">
        <p
          className="ev-text text-[10px] font-black uppercase tracking-widest"
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          {format(dateObj, "EEE")} {format(dateObj, "d")}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={`ev-text text-sm font-black truncate ${isPast ? "line-through" : ""}`}
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          {event.title}
        </span>
        {event.startTimeLabel && (
          <span
            className="ev-text text-xs font-bold ml-2 tabular-nums"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.startTimeLabel}
          </span>
        )}
      </div>
      {isNext && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-[#FDCC4B] bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 px-2 py-0.5 rounded-full">
          Next
        </span>
      )}
      {!isPast && event.externalLink && (
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
