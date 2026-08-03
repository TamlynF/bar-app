"use client";

import React, { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Search, Inbox, X, ChevronDown } from "lucide-react";
import { BandBookingCard, statusTheme, type BandRequest } from "./band-booking-card";
import { bandLifecycleStages, type BandLifecycleStage } from "@/lib/band-lifecycle";
import StatusCircle from "./status-circle";
import BandFiltersPopover, {
  EMPTY_FILTERS,
  SORT_LABELS,
  dateRangeLabel,
  type BandFilterState,
} from "./band-filters";
import { cn } from "@/lib/utils";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

const COLUMNS = ["new", "reviewing", "offered", "booked", "declined"] as const;

const toTitle = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const subscribeToNothing = () => () => {};

const serverNow = () => null;

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function firstPreferred(r: BandRequest): string | null {
  const ds = (r.preferred_dates ?? []).filter(Boolean).slice().sort();
  return ds[0] ?? null;
}

function sortValue(r: BandRequest, key: BandFilterState["sortKey"]): string {
  if (key === "modified") return r.updated_at || r.created_at || "";
  if (key === "preferred") return firstPreferred(r) ?? "";
  return r.created_at || "";
}

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
  initialStatuses?: string[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(
    () => new Set(initialStatuses.map((s) => s.trim().toLowerCase()).filter(Boolean))
  );
  const [filters, setFilters] = useState<BandFilterState>(EMPTY_FILTERS);
  const patchFilters = (patch: Partial<BandFilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() => new Set());
  const toggleColumn = (col: string) =>
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });

  const typeOptions = useMemo(() => optionsFor(initialRequests, "type"), [initialRequests]);
  const genreOptions = useMemo(() => optionsFor(initialRequests, "genre"), [initialRequests]);

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setActiveStatusFilters(next);
  };

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
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        const va = sortValue(a, filters.sortKey);
        const vb = sortValue(b, filters.sortKey);
        if (!va || !vb) return !va && !vb ? 0 : va ? -1 : 1;
        return filters.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [initialRequests, searchQuery, filters]);

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

  const mountedAt = useRef<number | null>(null);
  const clientNow = useCallback(() => (mountedAt.current ??= Date.now()), []);
  const nowMs = useSyncExternalStore(subscribeToNothing, clientNow, serverNow);

  const lifecycles = useMemo(() => {
    if (nowMs == null) return new Map<string, BandLifecycleStage>();
    return bandLifecycleStages(
      initialRequests.map((r) => {
        const ev = Array.isArray(r.linked_event) ? r.linked_event[0] : r.linked_event;
        return {
          id: r.id,
          status: r.status,
          eventId: r.event_id,
          eventIsActive: ev?.is_active === true,
          date: ev?.date,
          startTime: ev?.start_time,
          endTime: ev?.end_time,
        };
      }),
      new Date(nowMs)
    );
  }, [initialRequests, nowMs]);

  const totalShown = visibleColumns.reduce(
    (n, c) => n + (grouped.get(c)?.length ?? 0),
    0
  );

  const spreadColumns = visibleColumns.length <= 2;

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
      <div className="rounded-2xl border border-[#D8D5C8] bg-[#EFE8D4] shadow-md">
        <div className="flex flex-col items-center sm:flex-row">
          <div className="no-scrollbar w-full min-w-0 overflow-x-auto px-1 pt-2 sm:w-auto sm:shrink-0 sm:px-2 sm:pt-0">
            <div className="flex w-full items-stretch gap-0.5 px-1 py-3 sm:w-max sm:gap-1 sm:px-2">
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

          <div className="mx-3 border-t border-[#D8D5C8] sm:hidden" />
          <div className="my-2 hidden w-px self-stretch bg-[#D8D5C8] sm:block" />

          <div className="mb-3 flex w-full min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:mb-0 sm:px-4">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#D8D5C8] bg-white px-4 transition-colors focus-within:border-[#34451F]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
                <input
                  type="text"
                  placeholder="Search bands, genres..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#20231A] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[#5E6654]/40 placeholder:normal-case"
                />
              </div>
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#D8D5C8]"
                >
                  <X className="h-3.5 w-3.5 text-[#5E6654]/50" />
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

      {(activeChips.length > 0 || filters.sortKey !== "created" || filters.sortAsc) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              title={`Remove ${chip.label}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#34451F]/25 bg-[#34451F]/8 px-2.5 font-black text-[9px] tracking-wide text-[#34451F] uppercase transition-colors hover:bg-[#34451F]/15"
            >
              {chip.label}
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
          {(filters.sortKey !== "created" || filters.sortAsc) && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#D8D5C8] bg-[#EFE8D4] px-2.5 font-black text-[9px] tracking-wide text-[#34451F] uppercase">
              {SORT_LABELS[filters.sortKey]} · {filters.sortAsc ? "Oldest" : "Newest"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-auto font-black text-[10px] tracking-wide text-[#34451F] uppercase underline"
          >
            Clear all
          </button>
        </div>
      )}

      {totalShown === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5E6654]/50" />
          <p className="text-sm font-medium text-[#5E6654]">
            No band applications found
          </p>
        </div>
      ) : (
        <div className="no-scrollbar flex flex-col gap-2 pb-2 sm:flex-row sm:overflow-x-auto xl:overflow-x-visible">
          {visibleColumns.map((col) => {
            const theme = statusTheme[col];
            const items = grouped.get(col) ?? [];
            const isCollapsed = collapsedColumns.has(col);
            return (
              <section
                key={col}
                aria-label={`${theme.label} - ${items.length} request${items.length === 1 ? "" : "s"}`}
                className={cn(
                  "flex flex-col gap-2",
                  spreadColumns
                    ? "sm:min-w-0 sm:flex-1"
                    : "sm:w-72 sm:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleColumn(col)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${theme.label}`}
                  className={cn(
                    "sticky top-0 z-10 flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:brightness-97 sm:min-h-0",
                    theme.bg,
                    theme.border
                  )}
                >
                  <span className={cn("flex items-center gap-2", theme.text)}>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )}
                    />
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
                </button>

                {!isCollapsed && (
                  items.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white/60 py-8 text-center text-xs font-semibold text-[#5E6654]/60">
                      Nothing here
                    </p>
                  ) : (
                    items.map((req) => (
                      <BandBookingCard
                        key={req.id}
                        request={req}
                        wide={spreadColumns}
                        lifecycle={lifecycles.get(req.id) ?? null}
                      />
                    ))
                  )
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
