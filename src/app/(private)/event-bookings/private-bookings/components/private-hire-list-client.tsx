"use client";

import React, { useMemo, useState } from "react";
import { Search, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrivateHireCard, type PrivateHireRequest } from "./private-hire-card";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

// Mirrors the music-bookings stats bar: a coloured ring per status with the count.
const statusTheme: Record<string, { text: string; border: string; dot: string; ring: string }> = {
  all: { text: "text-[#1F1F1A]", border: "border-[#E6DFC8]", dot: "bg-[#5F624F]", ring: "ring-slate-500/40" },
  pending: { text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-500/40" },
  confirmed: { text: "text-green-700", border: "border-green-200", dot: "bg-green-500", ring: "ring-green-500/40" },
  cancelled: { text: "text-red-700", border: "border-red-200", dot: "bg-red-500", ring: "ring-red-500/40" },
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
    <div className="flex flex-col items-center gap-1.5 min-w-14 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all touch-manipulation hover:scale-105 active:scale-95",
          isActive ? `${theme.dot} ${theme.border} shadow-lg ring-4 ${theme.ring}` : `bg-white ${theme.border}`
        )}
      >
        <span className={cn("text-sm font-black leading-none", isActive ? "text-white" : theme.text)}>
          {count}
        </span>
      </button>
      <span className={cn("text-[10px] sm:text-[11px] font-black uppercase tracking-tight", isActive ? theme.text : "text-[#5F624F]")}>
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
  /** Status keys to pre-select in the filter (e.g. from ?status=pending). */
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

  const filteredRequests = useMemo(() => {
    return initialRequests
      .filter((r) => {
        const rStatus = normStatus(r.status);
        const matchesStatus =
          activeStatusFilters.size === 0 ? true : activeStatusFilters.has(rStatus);
        const q = searchQuery.trim().toLowerCase();
        return (
          matchesStatus &&
          (q === "" ||
            (r.full_name || "").toLowerCase().includes(q) ||
            (r.email || "").toLowerCase().includes(q) ||
            (r.reason_for_hire || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Sort: pending first, then by created_at desc
        const statusOrder: Record<string, number> = {
          pending: 0,
          confirmed: 1,
          cancelled: 2,
        };
        const sa = statusOrder[normStatus(a.status)] ?? 4;
        const sb = statusOrder[normStatus(b.status)] ?? 4;
        if (sa !== sb) return sa - sb;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [initialRequests, activeStatusFilters, searchQuery]);

  const stats = useMemo(() => {
    const getCount = (list: PrivateHireRequest[]) => list.length;
    return {
      total: getCount(initialRequests),
      pending: getCount(initialRequests.filter((r) => normStatus(r.status) === "pending")),
      confirmed: getCount(initialRequests.filter((r) => normStatus(r.status) === "confirmed")),
      cancelled: getCount(initialRequests.filter((r) => normStatus(r.status) === "cancelled")),
    };
  }, [initialRequests]);

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Stats + Search grouped card */}
      <div className="bg-white border border-[#E6DFC8] rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center">
          {/* Stats Bar */}
          <div className="overflow-x-auto no-scrollbar px-2 pt-2 sm:flex-1 sm:pt-0">
            <div className="flex items-stretch gap-3 w-full px-2 py-3 min-w-max sm:min-w-0 sm:justify-evenly sm:gap-0">
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
                label="Cancelled"
                isActive={activeStatusFilters.has("cancelled")}
                onClick={() => toggleStatusFilter("cancelled")}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E6DFC8] mx-3 sm:hidden" />
          <div className="hidden sm:block w-px bg-[#E6DFC8] sm:self-stretch sm:my-2" />

          {/* Search */}
          <div className="flex justify-center px-4 mb-3 sm:mb-0 sm:py-2 sm:px-3 sm:shrink-0">
            <div className="flex items-center gap-3 h-10 px-4 w-full max-w-sm sm:w-56 rounded-xl border border-[#E6DFC8] focus-within:border-[#5C4033] transition-colors">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Search names, emails..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
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
                  className="shrink-0 p-1 rounded-lg hover:bg-[#E6DFC8] transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#5F624F]/50" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2 pb-2">
        {filteredRequests.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#E6DFC8]">
            <Inbox className="w-10 h-10 text-[#5F624F]/50 mx-auto mb-3" />
            <p className="text-[#5F624F] text-sm font-medium">No private hire enquiries found</p>
          </div>
        ) : (
          filteredRequests.map((req) => <PrivateHireCard key={req.id} request={req} />)
        )}
      </div>
    </div>
  );
}
