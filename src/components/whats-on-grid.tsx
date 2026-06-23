"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, ChevronDown, CalendarX2 } from "lucide-react";
import { FilterTabs, type FilterTab } from "@/components/editorial/filter-tabs";
import { EventCard } from "@/components/editorial/event-card";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

const ALL = "all";

/** True if the event matches the (already-lowercased) search query. */
function matchesQuery(e: SerializedEvent, q: string): boolean {
  return (
    !q ||
    e.title.toLowerCase().includes(q) ||
    (e.subType?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Client island for the /whats-on schedule. Owns all interaction: the search
 * query, the active subtype filter, the "earlier this month" toggle, and the
 * single-open card (`openId`). Render order: search → full-bleed filter chips →
 * collapsible "Earlier this month" (past, above) → "Coming up" list → a
 * collapsible "{next month}" list. The `nextEventId` card is marked inline with
 * a pulsing "NEXT UP" label + neon ring.
 */
export function WhatsOnGrid({
  upcoming,
  past,
  later,
  tabs,
  nextEventId,
  nextMonthLabel,
}: {
  upcoming: SerializedEvent[];
  past: SerializedEvent[];
  later: SerializedEvent[];
  tabs: FilterTab[];
  nextEventId: number | null;
  nextMonthLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(ALL);
  const [showPast, setShowPast] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const q = query.trim().toLowerCase();

  const filteredUpcoming = useMemo(
    () =>
      upcoming.filter(
        (e) => (active === ALL || e.subType === active) && matchesQuery(e, q)
      ),
    [upcoming, active, q]
  );

  const filteredPast = useMemo(
    () =>
      past.filter(
        (e) => (active === ALL || e.subType === active) && matchesQuery(e, q)
      ),
    [past, active, q]
  );

  const filteredLater = useMemo(
    () =>
      later.filter(
        (e) => (active === ALL || e.subType === active) && matchesQuery(e, q)
      ),
    [later, active, q]
  );

  // Live counts reflect the search query but not the active filter, so the
  // chips show how many events each subtype would surface for the current search.
  const allTabs: FilterTab[] = useMemo(() => {
    const pool = [...upcoming, ...past].filter((e) => matchesQuery(e, q));
    const counts = new Map<string, number>();
    for (const e of pool) {
      if (e.subType) counts.set(e.subType, (counts.get(e.subType) ?? 0) + 1);
    }
    return [
      { key: ALL, label: "All", count: pool.length },
      ...tabs.map((t) => ({ ...t, count: counts.get(t.key) ?? 0 })),
    ];
  }, [tabs, upcoming, past, q]);

  // The past + later lists auto-open while a search is active so matches aren't hidden.
  const pastOpen = showPast || q.length > 0;
  const laterOpen = showLater || q.length > 0;

  const toggle = (id: number) => setOpenId((p) => (p === id ? null : id));

  return (
    <div className="mt-6">
      {/* Search */}
      <div className="relative mb-4">
        <label htmlFor="whatson-search" className="sr-only">
          Search events
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-2"
          aria-hidden="true"
        />
        <input
          id="whatson-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what's on…"
          className="w-full h-11 pl-11 pr-4 rounded-full bg-canvas-2 border border-hairline text-ink placeholder:text-ink-2/60 text-sm font-medium outline-none focus:border-white/25 transition-colors"
        />
      </div>

      {/* Filter chips — one full-bleed horizontal-scroll row */}
      {tabs.length > 0 && (
        <div className="mb-6">
          <FilterTabs tabs={allTabs} active={active} onChange={setActive} />
        </div>
      )}

      {/* Earlier this month — collapsed by default, above the upcoming list */}
      {past.length > 0 && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={pastOpen}
            className="group w-full flex items-center justify-center gap-2 bg-white/4 hover:bg-white/7 border border-hairline hover:border-white/20 rounded-2xl py-3.5 transition-all"
          >
            <span className="text-ink-2 text-[11px] font-black uppercase tracking-[0.2em]">
              {pastOpen
                ? "Hide earlier this month"
                : `Earlier this month (${filteredPast.length})`}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-ink-2 transition-transform ${pastOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {pastOpen &&
            (filteredPast.length > 0 ? (
              <div className="flex flex-col gap-4 mt-4 opacity-60">
                {filteredPast.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    isPast
                    open={openId === ev.id}
                    onToggle={() => toggle(ev.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-ink-2/70 text-xs mt-4">
                No earlier events match.
              </p>
            ))}
        </div>
      )}

      {/* Coming up */}
      <div className="flex items-center gap-4 mb-4">
        <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.25em] text-ink-2">
          Coming up
        </h3>
        <div className="flex-1 h-px bg-hairline" />
        <span className="shrink-0 text-ink-2 text-[11px] font-bold tabular-nums">
          {filteredUpcoming.length} {filteredUpcoming.length === 1 ? "event" : "events"}
        </span>
      </div>
      {filteredUpcoming.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredUpcoming.map((ev) => {
            const isNext = ev.id === nextEventId;
            return (
              <div key={ev.id} className="flex flex-col gap-2">
                {isNext && (
                  <div className="ad-blink flex items-center gap-2 px-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-neon shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-neon text-[10px] font-black uppercase tracking-[0.25em]">
                      Next up · {format(parseDate(ev.date), "EEE d MMM")}
                    </span>
                  </div>
                )}
                <EventCard
                  event={ev}
                  isNext={isNext}
                  open={openId === ev.id}
                  onToggle={() => toggle(ev.id)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white/3 border border-hairline rounded-2xl">
          <CalendarX2 className="w-7 h-7 text-ink-2/50 mx-auto mb-2" aria-hidden="true" />
          <p className="text-ink-2 font-black text-sm uppercase tracking-tight">
            Nothing coming up here
          </p>
          <p className="text-ink-2/70 text-xs mt-1">Try another filter or search</p>
        </div>
      )}

      {/* Next month — collapsed by default, shown with the same cards */}
      {later.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowLater((v) => !v)}
            aria-expanded={laterOpen}
            className="group w-full flex items-center justify-center gap-2 bg-white/4 hover:bg-white/7 border border-hairline hover:border-gold/30 rounded-2xl py-3.5 transition-all"
          >
            <span className="text-gold text-[11px] font-black uppercase tracking-[0.2em]">
              {laterOpen ? `Hide ${nextMonthLabel}` : `${nextMonthLabel} (${filteredLater.length})`}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gold transition-transform ${laterOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {laterOpen &&
            (filteredLater.length > 0 ? (
              <div className="flex flex-col gap-4 mt-4">
                {filteredLater.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    open={openId === ev.id}
                    onToggle={() => toggle(ev.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-ink-2/70 text-xs mt-4">
                No {nextMonthLabel} events match.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
