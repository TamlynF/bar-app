"use client";

import React, { useMemo, useState } from "react";
import { Search, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrivateHireCard, type PrivateHireRequest } from "./private-hire-card";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

const COLUMNS = ["pending", "confirmed", "cancelled"] as const;

const statusTheme: Record<
  string,
  { bg: string; text: string; border: string; dot: string; ring: string; label: string }
> = {
  all: { bg: "bg-[#F7F4EA]", text: "text-[#1F1F1A]", border: "border-[#E6DFC8]", dot: "bg-[#5F624F]", ring: "ring-slate-500/40", label: "Total" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500/40", label: "Pending" },
  confirmed: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500", ring: "ring-green-500/40", label: "Confirmed" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", ring: "ring-red-500/40", label: "Rejected" },
};

function StatusCircle({
  count,
  status,
  label,
  isActive,
  onClick,
}: {
  count: number;
  status: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const theme = statusTheme[status] || statusTheme.pending;
  return (
    <div className="flex min-w-14 shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`
        )}
      >
        <span className={cn("font-black text-sm leading-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("font-black text-[10px] tracking-tight uppercase sm:text-[11px]", isActive ? theme.text : "text-[#5F624F]")}>
        {label}
      </span>
    </div>
  );
}

export default function PrivateHireListClient({
  initialRequests,
  initialStatuses = [],
}: {
  initialRequests: PrivateHireRequest[];
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

  const searchedRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialRequests
      .filter(
        (r) =>
          q === "" ||
          (r.full_name || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q) ||
          (r.reason_for_hire || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [initialRequests, searchQuery]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => activeStatusFilters.size === 0 || activeStatusFilters.has(c)),
    [activeStatusFilters]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PrivateHireRequest[]>(COLUMNS.map((c) => [c, []]));
    for (const r of searchedRequests) map.get(normStatus(r.status))?.push(r);
    return map;
  }, [searchedRequests]);

  const totalShown = visibleColumns.reduce((n, c) => n + (grouped.get(c)?.length ?? 0), 0);

  const spreadColumns = visibleColumns.length <= 2;

  const stats = useMemo(() => {
    const countBy = (status: string) =>
      initialRequests.filter((r) => normStatus(r.status) === status).length;
    return {
      total: initialRequests.length,
      pending: countBy("pending"),
      confirmed: countBy("confirmed"),
      cancelled: countBy("cancelled"),
    };
  }, [initialRequests]);

  return (
    <div className="animate-in space-y-3 duration-500 fade-in">
      <div className="rounded-2xl border border-[#E6DFC8] bg-[#EFE8D4] shadow-md">
        <div className="flex flex-col items-center sm:flex-row">
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
                count={stats.pending}
                status="pending"
                label="Pending"
                isActive={activeStatusFilters.has("pending")}
                onClick={() => toggleStatusFilter("pending")}
              />
              <StatusCircle
                count={stats.confirmed}
                status="confirmed"
                label="Confirmed"
                isActive={activeStatusFilters.has("confirmed")}
                onClick={() => toggleStatusFilter("confirmed")}
              />
              <StatusCircle
                count={stats.cancelled}
                status="cancelled"
                label="Rejected"
                isActive={activeStatusFilters.has("cancelled")}
                onClick={() => toggleStatusFilter("cancelled")}
              />
            </div>
          </div>

          <div className="mx-3 border-t border-[#E6DFC8] sm:hidden" />
          <div className="my-2 hidden w-px self-stretch bg-[#E6DFC8] sm:block" />

          <div className="mb-3 flex w-full min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:mb-0 sm:px-4">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#E6DFC8] bg-white px-4 transition-colors focus-within:border-[#5C4033]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
                <input
                  type="text"
                  placeholder="Search names, emails..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
          </div>
        </div>
      </div>

      {totalShown === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6DFC8] bg-white py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5F624F]/50" />
          <p className="text-sm font-medium text-[#5F624F]">No private hire enquiries found</p>
        </div>
      ) : (
        <div className="no-scrollbar flex flex-col gap-2 pb-2 sm:flex-row sm:overflow-x-auto xl:overflow-x-visible">
          {visibleColumns.map((col) => {
            const theme = statusTheme[col];
            const items = grouped.get(col) ?? [];
            return (
              <section
                key={col}
                aria-label={`${theme.label} — ${items.length} enquir${items.length === 1 ? "y" : "ies"}`}
                className={cn(
                  "flex flex-col gap-2",
                  spreadColumns
                    ? "sm:min-w-0 sm:flex-1"
                    : "sm:w-72 sm:shrink-0 xl:w-auto xl:min-w-0 xl:flex-1"
                )}
              >
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
                  items.map((req) => <PrivateHireCard key={req.id} request={req} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
