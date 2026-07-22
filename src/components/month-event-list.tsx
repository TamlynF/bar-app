"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek } from "date-fns";
import { ExternalLink, ChevronDown, CalendarDays, Mic2 } from "lucide-react";
import { toast } from "sonner";

type MonthEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  externalLink: string | null;
  isFullyBooked: boolean;
  isBookable: boolean;
  bookingPageUrl: string | null;
  color: string;
  subType: string | null;
  isKaraoke: boolean;
  karaokeRequestUrl: string | null;
};

const ALL = "All";

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function groupByDate(evs: MonthEvent[]): MonthEvent[][] {
  const groups: MonthEvent[][] = [];
  const idx = new Map<string, MonthEvent[]>();
  for (const ev of evs) {
    let g = idx.get(ev.date);
    if (!g) { g = []; idx.set(ev.date, g); groups.push(g); }
    g.push(ev);
  }
  return groups;
}

export function MonthEventList({
  events,
  todayStr,
  excludeDate,
}: {
  events: MonthEvent[];
  todayStr: string;
  excludeDate: string | null;
}) {
  const [showPast, setShowPast] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(ALL);

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= todayStr && e.date !== excludeDate),
    [events, todayStr, excludeDate]
  );
  const past = useMemo(
    () => events.filter((e) => e.date < todayStr),
    [events, todayStr]
  );

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

  const effectiveFilter =
    activeFilter === ALL || filters.some((f) => f.label === activeFilter)
      ? activeFilter
      : ALL;

  const visibleUpcoming = useMemo(
    () =>
      effectiveFilter === ALL
        ? upcoming
        : upcoming.filter((e) => e.subType === effectiveFilter),
    [effectiveFilter, upcoming]
  );

  const visiblePast = useMemo(
    () =>
      effectiveFilter === ALL
        ? past
        : past.filter((e) => e.subType === effectiveFilter),
    [effectiveFilter, past]
  );

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
    <div className="space-y-3">
      {filters.length > 1 && (
        <div
          className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1"
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
                style={{ "--chip-c": f.color } as React.CSSProperties}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-black text-[10px] tracking-wide uppercase transition-colors active:scale-95 ${
                  isActive
                    ? f.label === ALL
                      ? "bg-[#FDCC4B] text-[#1a2008]"
                      : "bg-(--chip-c) text-[#1a2008]"
                    : "border border-white/8 bg-white/5 text-stone-400 hover:bg-white/8 hover:text-white"
                }`}
              >
                {f.label !== ALL && (
                  <span
                    className="ev-dot h-1.5 w-1.5 rounded-full"
                    style={{ "--ev-c": isActive ? "#1a2008" : f.color } as React.CSSProperties}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {Array.from(weeks.entries()).map(([weekKey, weekEvents], index) => (
        <div key={weekKey}>
          <div className="mb-1 flex items-center gap-2 px-1">
            <span className="font-black text-[10px] tracking-[0.25em] text-stone-500 uppercase">
              Week {index + 1}
            </span>
            <div className="h-px flex-1 bg-stone-800/50" />
          </div>
          <div className="divide-y divide-[#2a3610] overflow-hidden rounded-2xl border border-white/10 bg-[#26300D]">
            {groupByDate(weekEvents).map((g) =>
              g.length === 1 ? (
                <EventRow key={g[0].id} event={g[0]} isPast={false} />
              ) : (
                <EventCluster key={g[0].date} events={g} isPast={false} />
              )
            )}
          </div>
        </div>
      ))}

      {visibleUpcoming.length === 0 &&
        visiblePast.length === 0 &&
        (upcoming.length > 0 || past.length > 0) && (
          <p className="py-6 text-center text-xs font-bold tracking-widest text-stone-600 uppercase">
            No {effectiveFilter.toLowerCase()} events this month
          </p>
        )}

      {visiblePast.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPast((o) => !o)}
            aria-expanded={showPast}
            className="group mb-2 flex w-full items-center gap-2 px-1"
          >
            <span className="font-black text-[10px] tracking-[0.25em] text-stone-600 uppercase">
              Earlier this month ({visiblePast.length})
            </span>
            <div className="h-px flex-1 bg-stone-800/50" />
            <ChevronDown
              className={`h-4 w-4 text-stone-600 transition-transform ${
                showPast ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {showPast && (
            <div className="animate-in divide-y divide-[#2a3610] overflow-hidden rounded-2xl border border-white/10 bg-[#26300D] duration-200 fade-in slide-in-from-top-1">
              {groupByDate(visiblePast).map((g) =>
                g.length === 1 ? (
                  <EventRow key={g[0].id} event={g[0]} isPast />
                ) : (
                  <EventCluster key={g[0].date} events={g} isPast />
                )
              )}
            </div>
          )}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="py-6 text-center text-xs font-bold tracking-widest text-stone-600 uppercase">
          Nothing else this month
        </p>
      )}
    </div>
  );
}


function EventDateCell({
  dateObj,
  isPast,
  count,
}: {
  dateObj: Date;
  isPast: boolean;
  count: number;
}) {
  return (
    <div className="w-10 shrink-0 text-center">
      <p className="font-black text-[9px] leading-tight tracking-widest text-stone-500 uppercase">
        {format(dateObj, "EEE")}
      </p>
      <p
        className={`font-black text-base leading-none tabular-nums ${
          isPast ? "text-stone-300" : "text-white"
        }`}
      >
        {format(dateObj, "d")}
      </p>
      {count > 1 && (
        <span className="mt-1 inline-block rounded-full bg-[#FDCC4B]/10 px-1.5 py-0.5 font-black text-[8px] leading-none text-[#FDCC4B] tabular-nums">
          ×{count}
        </span>
      )}
    </div>
  );
}

function EventBody({ event, isPast }: { event: MonthEvent; isPast: boolean }) {
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  const subLine = [event.subType, timeLabel].filter(Boolean).join(" · ");

  return (
    <>
      <div className="min-w-0 flex-1">
        {event.externalLink && !isPast ? (
          <a
            href={event.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full min-w-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="ev-text truncate pb-px font-black text-sm leading-tight underline underline-offset-2"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </p>
            <ExternalLink className="h-3 w-3 shrink-0 text-stone-500" aria-hidden="true" />
          </a>
        ) : (
          <p
            className={`ev-text truncate font-black text-sm leading-tight ${
              isPast ? "line-through" : ""
            }`}
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </p>
        )}
        {subLine && (
          <p className="mt-0.5 truncate text-[10px] font-bold tracking-wide text-stone-500 uppercase">
            {subLine}
          </p>
        )}
      </div>

      {!isPast && event.isFullyBooked && (
        <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase">
          Sold Out
        </span>
      )}

      {!isPast && event.isKaraoke && event.karaokeRequestUrl && (
        <a
          href={event.karaokeRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-white uppercase transition-all hover:bg-[#FF6B35]/90 active:scale-95"
          aria-label="Request a song to sing on Singa"
        >
          <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          Sing
        </a>
      )}

      {!isPast && event.isKaraoke && !event.karaokeRequestUrl && (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 font-black text-[9px] tracking-wide text-stone-500 uppercase"
          title="Karaoke night hasn't started yet"
        >
          <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          Not Started
        </span>
      )}

      {!isPast && !event.isKaraoke && event.isBookable && event.bookingPageUrl && (
        <a
          href={event.bookingPageUrl}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FDCC4B] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-[#1a2008] uppercase transition-all hover:bg-[#FDCC4B]/90 active:scale-95"
          aria-label={`Book ${event.title}`}
        >
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          Book
        </a>
      )}
    </>
  );
}

function EventCluster({ events, isPast }: { events: MonthEvent[]; isPast: boolean }) {
  const dateObj = parseDate(events[0].date);
  const inner = (
    <div
      className={`flex items-stretch gap-3 bg-[#FDCC4B]/5 px-4 py-3 transition-colors ${
        isPast ? "opacity-50" : ""
      }`}
    >
      <EventDateCell dateObj={dateObj} isPast={isPast} count={events.length} />
      <div className="min-w-0 flex-1 divide-y divide-[#2a3610] border-l-2 border-[#FDCC4B]/40 pl-3">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <EventBody event={ev} isPast={isPast} />
          </div>
        ))}
      </div>
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
  return inner;
}

function EventRow({ event, isPast }: { event: MonthEvent; isPast: boolean }) {
  const dateObj = parseDate(event.date);
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isPast ? "opacity-50" : "hover:bg-white/4"
      }`}
    >
      <EventDateCell dateObj={dateObj} isPast={isPast} count={1} />
      <EventBody event={event} isPast={isPast} />
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
  return inner;
}
