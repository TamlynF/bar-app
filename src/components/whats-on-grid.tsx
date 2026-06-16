"use client";

import { useState, useMemo } from "react";
import { startOfWeek, format } from "date-fns";
import { ChevronDown, CalendarX2 } from "lucide-react";
import { FilterTabs, type FilterTab } from "@/components/editorial/filter-tabs";
import { EventCard } from "@/components/editorial/event-card";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

const ALL = "all";

/** Monday-start ISO week key (YYYY-MM-DD) for grouping. */
function weekKey(dateStr: string): string {
  return format(startOfWeek(parseDate(dateStr), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Groups an already-ordered event list into [weekKey, events] pairs, order preserved. */
function groupByWeek(events: SerializedEvent[]): [string, SerializedEvent[]][] {
  const map = new Map<string, SerializedEvent[]>();
  for (const ev of events) {
    const k = weekKey(ev.date);
    const g = map.get(k);
    if (g) g.push(ev);
    else map.set(k, [ev]);
  }
  return [...map.entries()];
}

/**
 * Client island for the /whats-on schedule: a sticky subtype filter bar over an
 * awwwards-style EventCard grid of upcoming events, grouped under sticky
 * "Week of…" headers, plus a collapsible "earlier this month" grid of past
 * events (dimmed). Filtering applies to both buckets.
 */
export function WhatsOnGrid({
  upcoming,
  past,
  tabs,
}: {
  upcoming: SerializedEvent[];
  past: SerializedEvent[];
  tabs: FilterTab[];
}) {
  const [active, setActive] = useState(ALL);
  const [showPast, setShowPast] = useState(false);

  const allTabs: FilterTab[] = [{ key: ALL, label: "All" }, ...tabs];

  const upcomingWeeks = useMemo(() => {
    const filtered = active === ALL ? upcoming : upcoming.filter((e) => e.subType === active);
    return groupByWeek(filtered);
  }, [upcoming, active]);

  const filteredPast = useMemo(
    () => (active === ALL ? past : past.filter((e) => e.subType === active)),
    [past, active]
  );

  const upcomingCount = upcomingWeeks.reduce((n, [, evs]) => n + evs.length, 0);

  return (
    <div>
      {tabs.length > 0 && (
        <FilterTabs tabs={allTabs} active={active} onChange={setActive} />
      )}

      {upcomingCount > 0 ? (
        <div className="mt-6">
          {upcomingWeeks.map(([key, evs]) => (
            <section key={key} className="mb-8">
              <h3 className="sticky top-28 sm:top-32 z-20 -mx-4 px-4 py-2 bg-[#1a2008]/90 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">
                Week of {format(parseDate(key), "d MMMM")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {evs.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white/3 border border-white/5 rounded-2xl mt-6">
          <CalendarX2 className="w-7 h-7 text-stone-700 mx-auto mb-2" />
          <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
            Nothing coming up here
          </p>
          <p className="text-stone-600 text-xs mt-1">Try another filter</p>
        </div>
      )}

      {filteredPast.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="group w-full flex items-center justify-center gap-2 bg-white/4 hover:bg-white/7 border border-white/10 hover:border-white/20 rounded-2xl py-3.5 transition-all"
          >
            <span className="text-stone-400 text-[11px] font-black uppercase tracking-[0.2em]">
              {showPast ? "Hide earlier this month" : `Earlier this month (${filteredPast.length})`}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-stone-400 transition-transform ${showPast ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {showPast && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 opacity-55">
              {filteredPast.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
