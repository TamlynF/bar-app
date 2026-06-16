"use client";

import { useState, useMemo } from "react";
import { ChevronDown, CalendarX2 } from "lucide-react";
import { FilterTabs, type FilterTab } from "@/components/editorial/filter-tabs";
import { EventCard } from "@/components/editorial/event-card";
import { type SerializedEvent } from "@/lib/events-display";

const ALL = "all";

/**
 * Client island for the /whats-on schedule: a sticky subtype filter bar over an
 * awwwards-style EventCard grid of upcoming events, plus a collapsible "earlier
 * this month" grid of past events (dimmed). Filtering applies to both buckets.
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

  const filteredUpcoming = useMemo(
    () => (active === ALL ? upcoming : upcoming.filter((e) => e.subType === active)),
    [upcoming, active]
  );
  const filteredPast = useMemo(
    () => (active === ALL ? past : past.filter((e) => e.subType === active)),
    [past, active]
  );

  return (
    <div>
      {tabs.length > 0 && (
        <FilterTabs tabs={allTabs} active={active} onChange={setActive} />
      )}

      {filteredUpcoming.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {filteredUpcoming.map((ev) => (
            <EventCard key={ev.id} event={ev} />
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
