"use client";

import React, { useMemo, useState } from "react";
import { Search, Inbox, X } from "lucide-react";
import { BandBookingCard, statusTheme, type BandRequest } from "./band-booking-card";
import StatusCircle from "./status-circle";
import BandFiltersPopover, {
  EMPTY_FILTERS,
  SORT_LABELS,
  dateRangeLabel,
  type BandFilterState,
} from "./band-filters";
import { cn } from "@/lib/utils";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

/** Board column order — the pipeline, left to right, with the terminal exit last. */
const COLUMNS = ["new", "reviewing", "offered", "booked", "declined"] as const;

const toTitle = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** Today as YYYY-MM-DD, to compare against the date columns (also YYYY-MM-DD). */
const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Earliest preferred date, or null. ISO dates sort lexicographically. */
function firstPreferred(r: BandRequest): string | null {
  const ds = (r.preferred_dates ?? []).filter(Boolean).slice().sort();
  return ds[0] ?? null;
}

/** The value a request is ordered by, per the chosen sort. "" = missing (sorts last). */
function sortValue(r: BandRequest, key: BandFilterState["sortKey"]): string {
  if (key === "modified") return r.updated_at || r.created_at || "";
  if (key === "preferred") return firstPreferred(r) ?? "";
  return r.created_at || "";
}

/** Distinct non-empty values of a field, as {key,label}, alphabetical. */
function optionsFor(requests: BandRequest[], field: "type" | "genre") {
  const keys = new Set<string>();
  for (const r of requests) {
    const v = (r[field] ?? "").trim().toLowerCase();
    if (v) keys.add(v);
  }
  return [...keys].sort().map((key) => ({ key, label: toTitle(key) }));
}

export default function BandBookingListClient({
  initialRequests,
  initialStatuses = [],
}: {
  initialRequests: BandRequest[];
  /** Status keys to pre-select in the filter (e.g. from ?status=new). */
  initialStatuses?: string[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(
    () => new Set(initialStatuses.map((s) => s.trim().toLowerCase()).filter(Boolean))
  );
  const [filters, setFilters] = useState<BandFilterState>(EMPTY_FILTERS);
  const patchFilters = (patch: Partial<BandFilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));

  // Only offer types/genres that actually exist in the data — a fixed list would
  // show options that match nothing.
  const typeOptions = useMemo(() => optionsFor(initialRequests, "type"), [initialRequests]);
  const genreOptions = useMemo(() => optionsFor(initialRequests, "genre"), [initialRequests]);

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setActiveStatusFilters(next);
  };

  // Search + the filter panel narrow what's on the board; the status circles choose
  // which columns show.
  const searchedRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const today = todayISO();

    const passesSearch = (r: BandRequest) =>
      q === "" ||
      (r.group_name || "").toLowerCase().includes(q) ||
      (r.booker_name || "").toLowerCase().includes(q) ||
      (r.genre || "").toLowerCase().includes(q) ||
      (r.type || "").toLowerCase().includes(q);

    const passesFilters = (r: BandRequest) => {
      if (filters.favOnly && !r.is_favorite) return false;

      const amount = r.payment_amount ?? 0;
      if (filters.fee === "free" && amount > 0) return false;
      if (filters.fee === "paid" && !(amount > 0)) return false;

      // Past/upcoming is about the booked slot, so an undated request is neither.
      if (filters.when !== "any") {
        if (!r.selected_date) return false;
        if (filters.when === "past" && r.selected_date >= today) return false;
        if (filters.when === "upcoming" && r.selected_date < today) return false;
      }

      if (filters.types.length && !filters.types.includes((r.type || "").toLowerCase()))
        return false;
      if (filters.genres.length && !filters.genres.includes((r.genre || "").toLowerCase()))
        return false;

      if (filters.slotRange?.start) {
        const { start, end } = filters.slotRange;
        if (!r.selected_date) return false;
        if (r.selected_date < start || r.selected_date > (end ?? start)) return false;
      }

      if (filters.prefRange?.start) {
        const { start, end } = filters.prefRange;
        const hit = (r.preferred_dates ?? [])
          .filter(Boolean)
          .some((d) => d >= start && d <= (end ?? start));
        if (!hit) return false;
      }

      return true;
    };

    return initialRequests
      .filter((r) => passesSearch(r) && passesFilters(r))
      .sort((a, b) => {
        // Favourites stay pinned to the top of their column, whatever the sort.
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        const va = sortValue(a, filters.sortKey);
        const vb = sortValue(b, filters.sortKey);
        // A request with nothing to sort on (no preferred dates) goes last either way.
        if (!va || !vb) return !va && !vb ? 0 : va ? -1 : 1;
        return filters.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [initialRequests, searchQuery, filters]);

  /** Which columns to render — all of them, unless the circles have narrowed it. */
  const visibleColumns = useMemo(
    () =>
      COLUMNS.filter(
        (c) => activeStatusFilters.size === 0 || activeStatusFilters.has(c)
      ),
    [activeStatusFilters]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, BandRequest[]>(COLUMNS.map((c) => [c, []]));
    for (const r of searchedRequests) map.get(normStatus(r.status))?.push(r);
    return map;
  }, [searchedRequests]);

  const totalShown = visibleColumns.reduce(
    (n, c) => n + (grouped.get(c)?.length ?? 0),
    0
  );

  /**
   * One status selected, so its column has the whole board to itself. The cards
   * spread into that width rather than staying at board-column proportions, and
   * spend it on detail the narrow card has no room for.
   */
  const soloColumn = visibleColumns.length === 1;

  /** One removable chip per active filter, in panel order. */
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.favOnly)
    activeChips.push({ key: "fav", label: "Favourites", clear: () => patchFilters({ favOnly: false }) });
  if (filters.fee !== "any")
    activeChips.push({ key: "fee", label: filters.fee, clear: () => patchFilters({ fee: "any" }) });
  if (filters.when !== "any")
    activeChips.push({ key: "when", label: filters.when, clear: () => patchFilters({ when: "any" }) });
  for (const t of filters.types)
    activeChips.push({
      key: `type:${t}`,
      label: toTitle(t),
      clear: () => patchFilters({ types: filters.types.filter((k) => k !== t) }),
    });
  for (const g of filters.genres)
    activeChips.push({
      key: `genre:${g}`,
      label: toTitle(g),
      clear: () => patchFilters({ genres: filters.genres.filter((k) => k !== g) }),
    });
  if (filters.slotRange?.start)
    activeChips.push({
      key: "slot",
      label: `Booked ${dateRangeLabel(filters.slotRange)}`,
      clear: () => patchFilters({ slotRange: null }),
    });
  if (filters.prefRange?.start)
    activeChips.push({
      key: "pref",
      label: `Preferred ${dateRangeLabel(filters.prefRange)}`,
      clear: () => patchFilters({ prefRange: null }),
    });

  const stats = useMemo(() => {
    const countBy = (status: string) =>
      initialRequests.filter((r) => normStatus(r.status) === status).length;
    return {
      total: initialRequests.length,
      new: countBy("new"),
      reviewing: countBy("reviewing"),
      offered: countBy("offered"),
      booked: countBy("booked"),
      declined: countBy("declined"),
    };
  }, [initialRequests]);

  return (
    <div className="animate-in space-y-3 duration-500 fade-in">
      {/* Stats + Search grouped card */}
      <div className="rounded-2xl border border-[#E6DFC8] bg-white shadow-sm">
        <div className="flex flex-col items-center sm:flex-row">
          {/* Stats Bar — takes only the width it needs, so the search can have the
              rest (it used to flex-1 and spread the circles across the header). */}
          <div className="no-scrollbar overflow-x-auto px-2 pt-2 sm:shrink-0 sm:pt-0">
            <div className="flex w-full min-w-max items-stretch gap-1 px-2 py-3">
              <StatusCircle
                count={stats.total}
                status="all"
                label="Total"
                isActive={activeStatusFilters.size === 0}
                onClick={() => setActiveStatusFilters(new Set())}
              />
              <StatusCircle
                count={stats.new}
                status="new"
                label="New"
                isActive={activeStatusFilters.has("new")}
                onClick={() => toggleStatusFilter("new")}
              />
              <StatusCircle
                count={stats.reviewing}
                status="reviewing"
                label="Reviewing"
                isActive={activeStatusFilters.has("reviewing")}
                onClick={() => toggleStatusFilter("reviewing")}
              />
              <StatusCircle
                count={stats.offered}
                status="offered"
                label="Offered"
                isActive={activeStatusFilters.has("offered")}
                onClick={() => toggleStatusFilter("offered")}
              />
              <StatusCircle
                count={stats.booked}
                status="booked"
                label="Booked"
                isActive={activeStatusFilters.has("booked")}
                onClick={() => toggleStatusFilter("booked")}
              />
              <StatusCircle
                count={stats.declined}
                status="declined"
                label="Declined"
                isActive={activeStatusFilters.has("declined")}
                onClick={() => toggleStatusFilter("declined")}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="mx-3 border-t border-[#E6DFC8] sm:hidden" />
          <div className="my-2 hidden w-px self-stretch bg-[#E6DFC8] sm:block" />

          {/* Search + Filters — takes the width the stats bar no longer claims. */}
          <div className="mb-3 flex w-full min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:mb-0 sm:px-4">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E6DFC8] px-4 transition-colors focus-within:border-[#5C4033]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
                <input
                  type="text"
                  placeholder="Search bands, genres..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5F624F]/40 placeholder:normal-case"
                />
              </div>
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#E6DFC8]"
                >
                  <X className="h-3.5 w-3.5 text-[#5F624F]/50" />
                </button>
              )}
            </div>
            <BandFiltersPopover
              value={filters}
              onChange={patchFilters}
              typeOptions={typeOptions}
              genreOptions={genreOptions}
            />
          </div>
        </div>
      </div>

      {/* What's on, and how to take it off — so the panel doesn't have to be
          reopened just to see (or undo) what's applied. */}
      {(activeChips.length > 0 || filters.sortKey !== "created" || filters.sortAsc) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              title={`Remove ${chip.label}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#5C4033]/25 bg-[#5C4033]/8 px-2.5 font-black text-[9px] tracking-wide text-[#5C4033] uppercase transition-colors hover:bg-[#5C4033]/15"
            >
              {chip.label}
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
          {(filters.sortKey !== "created" || filters.sortAsc) && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#E6DFC8] bg-[#EFE8D4] px-2.5 font-black text-[9px] tracking-wide text-[#5C4033] uppercase">
              {SORT_LABELS[filters.sortKey]} · {filters.sortAsc ? "Oldest" : "Newest"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-auto font-black text-[10px] tracking-wide text-[#5C4033] uppercase underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Status board — one column per pipeline stage */}
      {totalShown === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] bg-white py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5F624F]/50" />
          <p className="text-sm font-medium text-[#5F624F]">
            No band applications found
          </p>
        </div>
      ) : (
        // Stacked on mobile; a scrolling row of fixed columns from sm; from xl the
        // columns share the width equally and the scroll goes away entirely.
        <div className="no-scrollbar flex flex-col gap-2 pb-2 sm:flex-row sm:overflow-x-auto xl:overflow-x-visible">
          {visibleColumns.map((col) => {
            const theme = statusTheme[col];
            const items = grouped.get(col) ?? [];
            return (
              <section
                key={col}
                aria-label={`${theme.label} — ${items.length} request${items.length === 1 ? "" : "s"}`}
                // min-w-0 is what lets a column shrink past its cards' natural
                // width — without it five columns overflow the row. A solo column
                // takes the board from sm up: the fixed 72 belongs to a row of
                // columns that scrolls, and there's nothing to scroll past here.
                className={cn(
                  "flex flex-col gap-2",
                  soloColumn
                    ? "sm:min-w-0 sm:flex-1"
                    : "sm:w-72 sm:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1"
                )}
              >
                {/* Column header — sticks while the column scrolls past it */}
                <div
                  className={cn(
                    "sticky top-0 z-10 flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                    theme.bg,
                    theme.border
                  )}
                >
                  <span className={cn("flex items-center gap-2", theme.text)}>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", theme.dot)} />
                    <span className="font-black text-[11px] tracking-widest uppercase">
                      {theme.label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "min-w-6 rounded-full border bg-white px-1.5 text-center font-black text-[11px] leading-5",
                      theme.border,
                      theme.text
                    )}
                  >
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#E6DFC8] bg-white/60 py-8 text-center text-xs font-semibold text-[#5F624F]/60">
                    Nothing here
                  </p>
                ) : (
                  items.map((req) => (
                    <BandBookingCard key={req.id} request={req} wide={soloColumn} />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
