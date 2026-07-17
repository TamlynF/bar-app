"use client";

import React, { useMemo, useState } from "react";
import { Search, Inbox, X } from "lucide-react";
import { BandBookingCard, statusTheme, type BandRequest } from "./band-booking-card";
import StatusCircle from "./status-circle";
import { cn } from "@/lib/utils";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

/** Board column order — the pipeline, left to right, with the terminal exit last. */
const COLUMNS = ["new", "reviewing", "offered", "booked", "declined"] as const;

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

  const toggleStatusFilter = (status: string) => {
    const next = new Set(activeStatusFilters);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setActiveStatusFilters(next);
  };

  // Search narrows what's on the board; the status circles choose which columns show.
  const searchedRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialRequests
      .filter(
        (r) =>
          q === "" ||
          (r.group_name || "").toLowerCase().includes(q) ||
          (r.booker_name || "").toLowerCase().includes(q) ||
          (r.genre || "").toLowerCase().includes(q) ||
          (r.type || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Within a column: favourites first, then newest first.
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [initialRequests, searchQuery]);

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
          {/* Stats Bar */}
          <div className="no-scrollbar overflow-x-auto px-2 pt-2 sm:flex-1 sm:pt-0">
            <div className="flex w-full min-w-max items-stretch gap-3 px-2 py-3 sm:min-w-0 sm:justify-evenly sm:gap-0">
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

          {/* Search */}
          <div className="mb-3 flex shrink-0 justify-center px-3 py-2 sm:mb-0 sm:px-4">
            <div className="flex h-10 w-full max-w-sm items-center gap-3 rounded-xl border border-[#E6DFC8] px-4 transition-colors focus-within:border-[#5C4033] sm:w-56">
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
              {(activeStatusFilters.size > 0 || searchQuery.length > 0) && (
                <button
                  type="button"
                  title="Clear filters"
                  onClick={() => {
                    setActiveStatusFilters(new Set());
                    setSearchQuery("");
                  }}
                  className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#E6DFC8]"
                >
                  <X className="h-3.5 w-3.5 text-[#5F624F]/50" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
                // width — without it five columns overflow the row.
                className="flex flex-col gap-2 sm:w-72 sm:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1"
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
                  items.map((req) => <BandBookingCard key={req.id} request={req} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
