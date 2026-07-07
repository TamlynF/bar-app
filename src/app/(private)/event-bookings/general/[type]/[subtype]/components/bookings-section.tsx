"use client";

import React, { useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  User,
  Coins,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  Table as TableIcon,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusTheme } from "@/lib/booking-status-theme";
import BookingList, { type GeneralBooking } from "./booking-list";

export interface EventSummary {
  title: string;
  isActive: boolean;
  dateLabel: string;
  timeLabel: string;
  hostName: string;
  badgeClass: string | null;
  badgeLabel: string | null;
  /** Per-person price (null when the event is free) — drives the payment rows. */
  paymentAmount: number | null;
  /** Sum of expected booking totals (non-cancelled). */
  totalExpected: number;
  /** Sum of amounts actually paid (non-cancelled). */
  totalPaid: number;
  /** Present only for quiz-behaviour sub-categories. */
  quiz?: { status: string; count: number; total: number } | null;
  /** Present only when the event requires seating — capacity buckets. */
  tableStats?: { capacity: number; total: number; assigned: number }[] | null;
}

const sumGuests = (list: GeneralBooking[]) =>
  list.reduce((acc, b) => acc + (Number(b.group_size) || 0), 0);

const STAT_KEYS = ["all", "confirmed", "waitlisted", "pending", "cancelled"] as const;
const STAT_LABELS: Record<string, string> = {
  all: "Total",
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  pending: "Pending",
  cancelled: "Cancelled",
};

// ---- Compact event banner -------------------------------------------------
// Collapsible event context with an inline facts row and an optional Tables
// toggle that reveals the capacity buckets beneath it.
function EventBanner({
  summary,
  tablesOpen,
  onToggleTables,
}: {
  summary: EventSummary;
  tablesOpen: boolean;
  onToggleTables: (() => void) | null;
}) {
  const [open, setOpen] = useState(true);
  const hasPayments = summary.paymentAmount != null && summary.paymentAmount !== 0;

  return (
    <div className="rounded-2xl overflow-hidden flex bg-white border border-[#E6DFC8] shadow-sm">
      <div className="w-1.5 shrink-0 bg-[#5C4033]" />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 bg-[#ECE4CE]",
            open && "border-b border-[#E6DFC8]",
          )}
        >
          <h2 className="text-base font-black uppercase tracking-tight text-[#1F1F1A] truncate min-w-0">
            {summary.title || "Untitled Event"}
          </h2>
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border",
              summary.isActive
                ? "bg-green-100 text-green-700 border-green-300"
                : "bg-red-100 text-red-600 border-red-300",
            )}
          >
            {summary.isActive ? "Active" : "Inactive"}
          </span>
          <div className="flex-1" />
          {onToggleTables && (
            <button
              type="button"
              onClick={onToggleTables}
              aria-pressed={tablesOpen}
              aria-label="Toggle table status"
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors",
                tablesOpen
                  ? "bg-[#5C4033] text-white"
                  : "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8] hover:bg-[#E6DFC8]",
              )}
            >
              <TableIcon className="w-3.5 h-3.5" /> Tables
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label="Toggle event details"
            className="shrink-0 w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-[#5F624F] transition-colors hover:bg-black/5"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {/* Body — collapsible facts */}
        {open && (
          <div className="px-4 pb-3.5 pt-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
            <Meta icon={<CalendarDays className="w-3.5 h-3.5" />}>{summary.dateLabel}</Meta>
            <Meta icon={<Clock className="w-3.5 h-3.5" />}>{summary.timeLabel}</Meta>
            <Meta icon={<User className="w-3.5 h-3.5" />}>{summary.hostName}</Meta>
            {hasPayments && (
              <Meta icon={<Coins className="w-3.5 h-3.5" />}>
                <span className="text-green-700">£{summary.totalPaid.toFixed(2)}</span>
                <span className="text-[#5F624F]"> / £{summary.totalExpected.toFixed(2)}</span>
              </Meta>
            )}
            {summary.quiz && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide",
                  summary.quiz.status === "Complete" && "bg-green-100 text-green-700",
                  summary.quiz.status === "Incomplete" && "bg-orange-100 text-orange-700",
                  summary.quiz.status === "Not Started" && "bg-[#F7F4EA] text-[#5F624F]",
                )}
              >
                {summary.quiz.status === "Complete" && <CheckCircle2 className="w-3.5 h-3.5" />}
                {summary.quiz.status === "Incomplete" && <AlertCircle className="w-3.5 h-3.5" />}
                {summary.quiz.status === "Not Started" && <Info className="w-3.5 h-3.5" />}
                <span>Quiz {summary.quiz.status}</span>
                {summary.quiz.total > 0 && (
                  <span className="opacity-60 font-bold normal-case tracking-normal">
                    ({summary.quiz.count}/{summary.quiz.total})
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F1F1A]">
      <span className="text-[#5F624F]/70">{icon}</span>
      {children}
    </span>
  );
}

// ---- Table capacity buckets ----------------------------------------------
function TableStats({ buckets }: { buckets: { capacity: number; total: number; assigned: number }[] }) {
  const assigned = buckets.reduce((a, b) => a + b.assigned, 0);
  const total = buckets.reduce((a, b) => a + b.total, 0);
  return (
    <div className="rounded-2xl p-3.5 bg-white border border-[#E6DFC8] shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          <TableIcon className="w-3.5 h-3.5" /> Table Status
        </span>
        <span className="text-[10px] font-black uppercase tracking-wide tabular-nums text-[#5F624F]">
          {assigned}/{total} seated
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {buckets.map(g => {
          const full = g.assigned >= g.total;
          return (
            <div
              key={g.capacity}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-15 bg-[#F7F4EA] border",
                full ? "border-green-500/40" : "border-[#E6DFC8]",
              )}
            >
              <span className="text-[9px] font-black uppercase tracking-wide text-[#5F624F]">Cap {g.capacity}</span>
              <span className={cn("text-base font-black tabular-nums leading-tight", full ? "text-green-700" : "text-[#1F1F1A]")}>
                {g.assigned}
                <span className="text-[#5F624F]/45">/{g.total}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Compact status filter pill ------------------------------------------
function StatPill({
  statusKey,
  label,
  teamCount,
  guestCount,
  active,
  onClick,
}: {
  statusKey: string;
  label: string;
  teamCount: number;
  guestCount: number;
  active: boolean;
  onClick: () => void;
}) {
  const theme = statusTheme[statusKey] || statusTheme.pending;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 h-11 pl-2 pr-3.5 rounded-xl shrink-0 transition-all active:scale-[0.97]",
        active ? cn(theme.dot, "shadow-md") : "bg-white border border-[#E6DFC8]",
      )}
    >
      <span
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black tabular-nums",
          active ? "bg-white/25 text-white" : cn(theme.bg, theme.text),
        )}
      >
        {teamCount}
      </span>
      <span className="text-left leading-none">
        <span className={cn("block text-[11px] font-black uppercase tracking-wide", active ? "text-white" : "text-[#1F1F1A]")}>
          {label}
        </span>
        <span className={cn("block text-[9.5px] font-bold uppercase tracking-wide mt-0.5", active ? "text-white/80" : "text-[#5F624F]")}>
          {guestCount} guests
        </span>
      </span>
    </button>
  );
}

export default function BookingsSection({
  bookings,
  summary,
  type,
  subtype,
  initialStatuses = [],
}: {
  bookings: GeneralBooking[];
  /** Present when an event is selected — enables the interactive stats bar. */
  summary: EventSummary | null;
  type: string;
  subtype: string;
  /** Status keys to pre-select in the filter (e.g. from ?status=confirmed). */
  initialStatuses?: string[];
}) {
  const seededStatuses = initialStatuses.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(
    () => new Set(seededStatuses)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(seededStatuses.length > 0);
  const [showTables, setShowTables] = useState(false);

  const toggleStatusFilter = (status: string) => {
    setActiveStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const statCounts = useMemo(
    () =>
      STAT_KEYS.map(key => {
        const list = key === "all" ? bookings : bookings.filter(b => (b.status || "").toLowerCase() === key);
        return { key, label: STAT_LABELS[key], teams: list.length, guests: sumGuests(list) };
      }),
    [bookings],
  );

  // Status (multi-select) + search filtering driven by the stat pills / search.
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter(b => {
      const matchesStatus =
        activeStatusFilters.size === 0 ? true : activeStatusFilters.has((b.status || "").toLowerCase());
      return (
        matchesStatus &&
        (q === "" ||
          (b.group_name || "").toLowerCase().includes(q) ||
          (b.contacts?.full_name || "").toLowerCase().includes(q))
      );
    });
  }, [bookings, activeStatusFilters, searchQuery]);

  const activeCount = activeStatusFilters.size;
  const hasTableStats = !!(summary?.tableStats && summary.tableStats.length > 0);

  return (
    <>
      {/* Event context — only when an event is selected */}
      {summary && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <EventBanner
            summary={summary}
            tablesOpen={showTables}
            onToggleTables={hasTableStats ? () => setShowTables(o => !o) : null}
          />
          {hasTableStats && showTables && <TableStats buckets={summary.tableStats!} />}
        </div>
      )}

      {/* Search + Filters toggle */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 h-11 px-3.5 rounded-xl bg-white border border-[#E6DFC8] focus-within:border-[#5C4033] transition-colors flex-1 min-w-0">
            <Search className="w-4 h-4 shrink-0 text-[#5F624F]/60" />
            <input
              type="text"
              placeholder="Search teams or hosts…"
              aria-label="Search bookings"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[#5F624F] hover:bg-[#E6DFC8] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(o => !o)}
            aria-pressed={showFilters}
            aria-label="Toggle status filters"
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors",
              showFilters || activeCount > 0
                ? "bg-[#5C4033] text-white"
                : "bg-white text-[#5F624F] border border-[#E6DFC8] hover:bg-[#F7F4EA]",
            )}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] tabular-nums bg-white/25 text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Status filter pills */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-0.5 pb-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {statCounts.map(s => (
              <StatPill
                key={s.key}
                statusKey={s.key}
                label={s.label}
                teamCount={s.teams}
                guestCount={s.guests}
                active={s.key === "all" ? activeCount === 0 : activeStatusFilters.has(s.key)}
                onClick={() => (s.key === "all" ? setActiveStatusFilters(new Set()) : toggleStatusFilter(s.key))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bookings count + clear */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">
          Bookings ({filteredBookings.length})
        </span>
        {(activeCount > 0 || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setActiveStatusFilters(new Set());
              setSearchQuery("");
            }}
            className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bookings list + master–detail */}
      <BookingList bookings={filteredBookings} showDate={!summary} type={type} subtype={subtype} />
    </>
  );
}
