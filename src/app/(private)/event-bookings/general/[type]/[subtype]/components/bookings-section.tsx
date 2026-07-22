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
  paymentAmount: number | null;
  totalExpected: number;
  totalPaid: number;
  quiz?: { status: string; count: number; total: number } | null;
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
    <div className="flex overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white shadow-sm">
      <div className="w-1.5 shrink-0 bg-[#5C4033]" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-center gap-2.5 bg-[#ECE4CE] px-4 py-3",
            open && "border-b border-[#E6DFC8]",
          )}
        >
          <h2 className="min-w-0 truncate font-black text-base tracking-tight text-[#1F1F1A] uppercase">
            {summary.title || "Untitled Event"}
          </h2>
          <span
            className={cn(
              "shrink-0 rounded-md border px-2 py-0.5 font-black text-[9px] tracking-wide uppercase",
              summary.isActive
                ? "border-green-300 bg-green-100 text-green-700"
                : "border-red-300 bg-red-100 text-red-600",
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
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-black text-[10px] tracking-wide uppercase transition-colors",
                tablesOpen
                  ? "bg-[#5C4033] text-white"
                  : "border border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F] hover:bg-[#E6DFC8]",
              )}
            >
              <TableIcon className="h-3.5 w-3.5" /> Tables
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label="Toggle event details"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5F624F] transition-colors hover:bg-black/5"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-3 pb-3.5">
            <Meta icon={<CalendarDays className="h-3.5 w-3.5" />}>{summary.dateLabel}</Meta>
            <Meta icon={<Clock className="h-3.5 w-3.5" />}>{summary.timeLabel}</Meta>
            <Meta icon={<User className="h-3.5 w-3.5" />}>{summary.hostName}</Meta>
            {hasPayments && (
              <Meta icon={<Coins className="h-3.5 w-3.5" />}>
                <span className="text-green-700">£{summary.totalPaid.toFixed(2)}</span>
                <span className="text-[#5F624F]"> / £{summary.totalExpected.toFixed(2)}</span>
              </Meta>
            )}
            {summary.quiz && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-black text-[10px] tracking-wide uppercase",
                  summary.quiz.status === "Complete" && "bg-green-100 text-green-700",
                  summary.quiz.status === "Incomplete" && "bg-orange-100 text-orange-700",
                  summary.quiz.status === "Not Started" && "bg-[#F7F4EA] text-[#5F624F]",
                )}
              >
                {summary.quiz.status === "Complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
                {summary.quiz.status === "Incomplete" && <AlertCircle className="h-3.5 w-3.5" />}
                {summary.quiz.status === "Not Started" && <Info className="h-3.5 w-3.5" />}
                <span>Quiz {summary.quiz.status}</span>
                {summary.quiz.total > 0 && (
                  <span className="font-bold tracking-normal normal-case opacity-60">
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

function TableStats({ buckets }: { buckets: { capacity: number; total: number; assigned: number }[] }) {
  const assigned = buckets.reduce((a, b) => a + b.assigned, 0);
  const total = buckets.reduce((a, b) => a + b.total, 0);
  return (
    <div className="animate-in rounded-2xl border border-[#E6DFC8] bg-white p-3.5 shadow-sm duration-200 fade-in slide-in-from-top-1">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
          <TableIcon className="h-3.5 w-3.5" /> Table Status
        </span>
        <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase tabular-nums">
          {assigned}/{total} seated
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {buckets.map(g => {
          const full = g.assigned >= g.total;
          return (
            <div
              key={g.capacity}
              className={cn(
                "flex min-w-15 flex-col items-center justify-center rounded-xl border bg-[#F7F4EA] px-3 py-2",
                full ? "border-green-500/40" : "border-[#E6DFC8]",
              )}
            >
              <span className="font-black text-[9px] tracking-wide text-[#5F624F] uppercase">Cap {g.capacity}</span>
              <span className={cn("font-black text-base leading-tight tabular-nums", full ? "text-green-700" : "text-[#1F1F1A]")}>
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
        "group flex h-11 shrink-0 items-center gap-2.5 rounded-xl pr-3.5 pl-2 transition-all active:scale-[0.97]",
        active ? cn(theme.dot, "shadow-md") : "border border-[#E6DFC8] bg-white",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg font-black text-sm tabular-nums",
          active ? "bg-white/25 text-white" : cn(theme.bg, theme.text),
        )}
      >
        {teamCount}
      </span>
      <span className="text-left leading-none">
        <span className={cn("block font-black text-[11px] tracking-wide uppercase", active ? "text-white" : "text-[#1F1F1A]")}>
          {label}
        </span>
        <span className={cn("mt-0.5 block text-[9.5px] font-bold tracking-wide uppercase", active ? "text-white/80" : "text-[#5F624F]")}>
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
  eventFilter,
}: {
  bookings: GeneralBooking[];
  summary: EventSummary | null;
  type: string;
  subtype: string;
  initialStatuses?: string[];
  eventFilter?: React.ReactNode;
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
      {summary && (
        <div className="animate-in space-y-3 duration-300 fade-in slide-in-from-top-2">
          <EventBanner
            summary={summary}
            tablesOpen={showTables}
            onToggleTables={hasTableStats ? () => setShowTables(o => !o) : null}
          />
          {hasTableStats && showTables && <TableStats buckets={summary.tableStats!} />}
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {eventFilter && <div className="sm:w-56 sm:shrink-0 lg:w-72">{eventFilter}</div>}
          <div className="flex items-center gap-2 sm:min-w-0 sm:flex-1">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#E6DFC8] bg-white px-3.5 transition-colors focus-within:border-[#5C4033]">
            <Search className="h-4 w-4 shrink-0 text-[#5F624F]/60" />
            <input
              type="text"
              placeholder="Search teams or hosts…"
              aria-label="Search bookings"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#1F1F1A] outline-none placeholder:font-normal placeholder:text-[#5F624F]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[#5F624F] transition-colors hover:bg-[#E6DFC8]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(o => !o)}
            aria-pressed={showFilters}
            aria-label="Toggle status filters"
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 font-black text-[11px] tracking-wide uppercase transition-colors",
              showFilters || activeCount > 0
                ? "bg-[#5C4033] text-white"
                : "border border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeCount > 0 && (
              <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] text-white tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
          </div>
        </div>

        {showFilters && (
          <div className="no-scrollbar flex animate-in gap-2 overflow-x-auto px-0.5 pb-0.5 duration-200 fade-in slide-in-from-top-1">
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

      <div className="flex items-center justify-between px-0.5">
        <span className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">
          Bookings ({filteredBookings.length})
        </span>
        {(activeCount > 0 || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setActiveStatusFilters(new Set());
              setSearchQuery("");
            }}
            className="font-black text-[10px] tracking-wide text-[#5C4033] uppercase"
          >
            Clear
          </button>
        )}
      </div>

      <BookingList bookings={filteredBookings} showDate={!summary} type={type} subtype={subtype} />
    </>
  );
}
