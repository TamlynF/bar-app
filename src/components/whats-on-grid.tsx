"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, CalendarX2, SlidersHorizontal } from "lucide-react";
import { FilterTabs, type FilterTab } from "@/components/editorial/filter-tabs";
import { EventGridCard } from "@/components/editorial/event-grid-card";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

const ALL = "all";
const PAGE_SIZE = 12;

function SoldOutToggle({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="Show sold out shows"
      onClick={onToggle}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 font-black text-[11px] tracking-wide whitespace-nowrap uppercase transition-colors sm:h-9",
        active
          ? "border-gold/40 bg-gold/15 text-gold"
          : "border-hairline bg-canvas-2 text-ink-2 hover:bg-white/10 hover:text-ink",
        className
      )}
    >
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", active ? "bg-gold" : "bg-stone-600")}
        aria-hidden="true"
      />
      Sold out
    </button>
  );
}

function matchesQuery(e: SerializedEvent, q: string): boolean {
  return (
    !q ||
    e.title.toLowerCase().includes(q) ||
    (e.subType?.toLowerCase().includes(q) ?? false) ||
    (e.tagline?.toLowerCase().includes(q) ?? false)
  );
}

export function WhatsOnGrid({
  upcoming,
  past,
  tabs,
}: {
  upcoming: SerializedEvent[];
  past: SerializedEvent[];
  tabs: FilterTab[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(ALL);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = query.trim().toLowerCase();

  const filteredUpcoming = useMemo(
    () =>
      upcoming.filter(
        (e) =>
          (active === ALL || e.subType === active) &&
          matchesQuery(e, q) &&
          (showSoldOut || !e.isFullyBooked)
      ),
    [upcoming, active, q, showSoldOut]
  );

  const filteredPast = useMemo(
    () => past.filter((e) => (active === ALL || e.subType === active) && matchesQuery(e, q)),
    [past, active, q]
  );

  const allTabs: FilterTab[] = useMemo(() => {
    const pool = upcoming.filter(
      (e) => matchesQuery(e, q) && (showSoldOut || !e.isFullyBooked)
    );
    const counts = new Map<string, number>();
    for (const e of pool) {
      if (e.subType) counts.set(e.subType, (counts.get(e.subType) ?? 0) + 1);
    }
    return [
      { key: ALL, label: "All", count: pool.length },
      ...tabs.map((t) => ({ ...t, count: counts.get(t.key) ?? 0 })),
    ];
  }, [tabs, upcoming, q, showSoldOut]);

  const shown = filteredUpcoming.slice(0, visible);
  const remaining = filteredUpcoming.length - shown.length;
  const pastOpen = showPast || q.length > 0;
  const filtersActive = active !== ALL || showSoldOut;

  function toggleSoldOut() {
    setShowSoldOut((v) => !v);
    setVisible(PAGE_SIZE);
  }

  return (
    <div className="mt-6">
      <div className="sticky top-14 z-30 -mx-4 mb-6 bg-canvas/90 px-4 pt-3 pb-3 backdrop-blur-xl sm:top-16 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="rounded-3xl border border-hairline bg-white/3 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1">
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search what's on…"
                className="h-12 w-full rounded-full border border-hairline bg-canvas-2 pr-4 pl-11 text-sm font-medium text-ink transition-colors outline-none placeholder:text-ink-2/60 focus:border-white/25"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="whatson-filters"
              className={cn(
                "inline-flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 font-black text-[11px] tracking-wide whitespace-nowrap uppercase transition-colors",
                filtersOpen || filtersActive
                  ? "border-gold/40 bg-gold/15 text-gold"
                  : "border-hairline bg-canvas-2 text-ink-2 hover:bg-white/10 hover:text-ink"
              )}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Filters</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", filtersOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </div>

          {filtersOpen && (
            <div
              id="whatson-filters"
              className="animate-in mt-3 flex items-center gap-3 duration-200 fade-in"
            >
              {tabs.length > 0 ? (
                <>
                  <div className="min-w-0 flex-1">
                    <FilterTabs
                      tabs={allTabs}
                      active={active}
                      onChange={(key) => {
                        setActive(key);
                        setVisible(PAGE_SIZE);
                      }}
                      trailing={
                        <SoldOutToggle
                          active={showSoldOut}
                          onToggle={toggleSoldOut}
                          className="sm:hidden"
                        />
                      }
                    />
                  </div>
                  <SoldOutToggle
                    active={showSoldOut}
                    onToggle={toggleSoldOut}
                    className="ml-auto hidden sm:inline-flex"
                  />
                </>
              ) : (
                <SoldOutToggle active={showSoldOut} onToggle={toggleSoldOut} className="ml-auto" />
              )}
            </div>
          )}
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((ev) => (
            <EventGridCard key={ev.id} event={ev} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-hairline bg-white/3 py-12 text-center">
          <CalendarX2 className="mx-auto mb-2 h-7 w-7 text-ink-2/50" aria-hidden="true" />
          <p className="font-black text-sm tracking-tight text-ink-2 uppercase">
            Nothing coming up here
          </p>
          <p className="mt-1 text-xs text-ink-2/70">Try another filter or search</p>
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-hairline bg-white/4 px-8 font-black text-[11px] tracking-[0.2em] text-ink uppercase transition-all hover:border-gold/30 hover:bg-white/7"
          >
            Show more ({remaining})
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-12">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={pastOpen}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-white/4 py-3.5 transition-all hover:border-white/20 hover:bg-white/7"
          >
            <span className="font-black text-[11px] tracking-[0.2em] text-ink-2 uppercase">
              {pastOpen ? "Hide past shows" : `Past shows (${filteredPast.length})`}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-ink-2 transition-transform ${pastOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {pastOpen &&
            (filteredPast.length > 0 ? (
              <ul className="mt-5 grid grid-cols-1 gap-5 opacity-60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPast.map((ev) => (
                  <EventGridCard key={ev.id} event={ev} isPast />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-center text-xs text-ink-2/70">No past shows match.</p>
            ))}
        </div>
      )}
    </div>
  );
}
