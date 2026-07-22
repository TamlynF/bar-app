"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, ChevronDown, CalendarX2 } from "lucide-react";
import { FilterTabs, type FilterTab } from "@/components/editorial/filter-tabs";
import { EventCard } from "@/components/editorial/event-card";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

const ALL = "all";

function matchesQuery(e: SerializedEvent, q: string): boolean {
  return (
    !q ||
    e.title.toLowerCase().includes(q) ||
    (e.subType?.toLowerCase().includes(q) ?? false)
  );
}

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

  const pastOpen = showPast || q.length > 0;
  const laterOpen = showLater || q.length > 0;

  const toggle = (id: number) => setOpenId((p) => (p === id ? null : id));

  return (
    <div className="mt-6">
      <div className="relative mb-4">
        <label htmlFor="whatson-search" className="sr-only">
          Search events
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-2"
          aria-hidden="true"
        />
        <input
          id="whatson-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what's on…"
          className="h-11 w-full rounded-full border border-hairline bg-canvas-2 pr-4 pl-11 text-sm font-medium text-ink transition-colors outline-none placeholder:text-ink-2/60 focus:border-white/25"
        />
      </div>

      {tabs.length > 0 && (
        <div className="mb-6">
          <FilterTabs tabs={allTabs} active={active} onChange={setActive} />
        </div>
      )}

      {past.length > 0 && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={pastOpen}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-white/4 py-3.5 transition-all hover:border-white/20 hover:bg-white/7"
          >
            <span className="font-black text-[11px] tracking-[0.2em] text-ink-2 uppercase">
              {pastOpen
                ? "Hide earlier this month"
                : `Earlier this month (${filteredPast.length})`}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-ink-2 transition-transform ${pastOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {pastOpen &&
            (filteredPast.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4 opacity-60">
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
              <p className="mt-4 text-center text-xs text-ink-2/70">
                No earlier events match.
              </p>
            ))}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <h3 className="shrink-0 font-black text-[10px] tracking-[0.25em] text-ink-2 uppercase">
          Coming up
        </h3>
        <div className="h-px flex-1 bg-hairline" />
        <span className="shrink-0 text-[11px] font-bold text-ink-2 tabular-nums">
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
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon"
                      aria-hidden="true"
                    />
                    <span className="font-black text-[10px] tracking-[0.25em] text-neon uppercase">
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
        <div className="rounded-2xl border border-hairline bg-white/3 py-12 text-center">
          <CalendarX2 className="mx-auto mb-2 h-7 w-7 text-ink-2/50" aria-hidden="true" />
          <p className="font-black text-sm tracking-tight text-ink-2 uppercase">
            Nothing coming up here
          </p>
          <p className="mt-1 text-xs text-ink-2/70">Try another filter or search</p>
        </div>
      )}

      {later.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowLater((v) => !v)}
            aria-expanded={laterOpen}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-white/4 py-3.5 transition-all hover:border-gold/30 hover:bg-white/7"
          >
            <span className="font-black text-[11px] tracking-[0.2em] text-gold uppercase">
              {laterOpen ? `Hide ${nextMonthLabel}` : `${nextMonthLabel} (${filteredLater.length})`}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gold transition-transform ${laterOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {laterOpen &&
            (filteredLater.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
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
              <p className="mt-4 text-center text-xs text-ink-2/70">
                No {nextMonthLabel} events match.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
