"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek } from "date-fns";
import { ExternalLink, ChevronDown } from "lucide-react";
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

const ALL = "All";

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Renders the current month's events in two clearly separated buckets:
 *
 *  1. UPCOMING (date >= today, excluding the hero event) — grouped by ISO week
 *     (Monday start), always visible, full opacity. Filterable by sub-type via
 *     the chip row.
 *  2. PAST (date < today) — collapsed behind an "earlier this month" toggle,
 *     rendered at 50% opacity with struck-through titles. Respects the active
 *     filter, same as the upcoming bucket, and shows a count in its label.
 *
 * The filter chips are derived from the sub-types actually present in the
 * upcoming events (deduped, in first-seen order), prefixed with "All". No chip
 * ever appears that wouldn't match at least one event.
 */
export function MonthEventList({
  events,
  todayStr,
  excludeId,
}: {
  events: MonthEvent[];
  todayStr: string;
  excludeId: number | null;
}) {
  const [showPast, setShowPast] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(ALL);

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= todayStr && e.id !== excludeId),
    [events, todayStr, excludeId]
  );
  const past = useMemo(
    () => events.filter((e) => e.date < todayStr),
    [events, todayStr]
  );

  // Chips: "All" + each distinct sub-type present this month, in first-seen
  // order (upcoming first, then any sub-types that only appear in past events,
  // so filtering still reveals them in the collapsed bucket). A type colour
  // rides along for the active-dot accent.
  const filters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of [...upcoming, ...past]) {
      if (e.subType && !seen.has(e.subType)) seen.set(e.subType, e.color);
    }
    return [
      { label: ALL, color: "#FDCC4B" },
      ...Array.from(seen.entries()).map(([label, color]) => ({ label, color })),
    ];
  }, [upcoming, past]);

  // If the active filter no longer matches anything (e.g. data changed), fall back to All.
  const effectiveFilter =
    activeFilter === ALL || filters.some((f) => f.label === activeFilter)
      ? activeFilter
      : ALL;

  const visibleUpcoming =
    effectiveFilter === ALL
      ? upcoming
      : upcoming.filter((e) => e.subType === effectiveFilter);

  const visiblePast =
    effectiveFilter === ALL
      ? past
      : past.filter((e) => e.subType === effectiveFilter);

  // Group the visible upcoming events by week
  const weeks = useMemo(() => {
    const map = new Map<string, MonthEvent[]>();
    for (const ev of visibleUpcoming) {
      const weekStart = startOfWeek(parseDate(ev.date), { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      const group = map.get(key) ?? [];
      group.push(ev);
      map.set(key, group);
    }
    return map;
  }, [visibleUpcoming]);

  return (
    <div className="space-y-6">
      {/* Filter chips — only show if there's more than one option (i.e. at
          least one sub-type beyond "All") */}
      {filters.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1"
          role="group"
          aria-label="Filter events by type"
        >
          {filters.map((f) => {
            const isActive = effectiveFilter === f.label;
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(f.label)}
                className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors active:scale-95 ${
                  isActive
                    ? "bg-[#FDCC4B] text-[#1a2008]"
                    : "bg-white/[0.05] text-stone-400 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                {f.label !== ALL && (
                  <span
                    className="ev-dot w-1.5 h-1.5 rounded-full"
                    style={{ "--ev-c": isActive ? "#1a2008" : f.color } as React.CSSProperties}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Upcoming, grouped by week */}
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
                <EventRow key={ev.id} event={ev} isPast={false} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state when the active filter matches nothing this month */}
      {visibleUpcoming.length === 0 &&
        visiblePast.length === 0 &&
        (upcoming.length > 0 || past.length > 0) && (
          <p className="text-center text-stone-600 text-xs font-bold uppercase tracking-widest py-6">
            No {effectiveFilter.toLowerCase()} events this month
          </p>
        )}

      {/* Past — collapsed toggle (respects the active filter) */}
      {visiblePast.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPast((o) => !o)}
            aria-expanded={showPast}
            className="group w-full flex items-center gap-2 px-1 mb-2"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-600">
              Earlier this month ({visiblePast.length})
            </span>
            <div className="flex-1 h-px bg-stone-800/50" />
            <ChevronDown
              className={`w-4 h-4 text-stone-600 transition-transform ${
                showPast ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {showPast && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl divide-y divide-white/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
              {visiblePast.map((ev) => (
                <EventRow key={ev.id} event={ev} isPast />
              ))}
            </div>
          )}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-center text-stone-600 text-xs font-bold uppercase tracking-widest py-6">
          Nothing else this month
        </p>
      )}
    </div>
  );
}

function EventRow({ event, isPast }: { event: MonthEvent; isPast: boolean }) {
  const dateObj = parseDate(event.date);

  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-4 transition-colors ${
        isPast ? "opacity-50" : "hover:bg-white/[0.04]"
      }`}
    >
      <span
        className="ev-dot shrink-0 w-2 h-2 rounded-full"
        style={{ "--ev-c": event.color } as React.CSSProperties}
      />

      <div className="shrink-0 w-12">
        <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest leading-tight">
          {format(dateObj, "EEE")}
        </p>
        <p
          className={`text-base font-black tabular-nums leading-none ${
            isPast ? "text-stone-300" : "text-white"
          }`}
        >
          {format(dateObj, "d")}
        </p>
      </div>

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
              {event.startTimeLabel}
              {event.endTimeLabel ? ` - ${event.endTimeLabel}` : ""}
            </span>
          )}
        </div>
      </div>

      {!isPast && event.isFullyBooked && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
          Sold Out
        </span>
      )}
      {!isPast && !event.isFullyBooked && event.externalLink && (
        <ExternalLink className="w-3.5 h-3.5 text-stone-600 shrink-0" aria-hidden="true" />
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