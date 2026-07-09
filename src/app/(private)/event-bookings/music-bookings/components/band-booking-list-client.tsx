"use client";

import React, { useMemo, useState } from "react";
import { Search, Inbox, X } from "lucide-react";
import { BandBookingCard, type BandRequest } from "./band-booking-card";
import StatusCircle from "./status-circle";

const normStatus = (s?: string) => (s || "").trim().toLowerCase();

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

  const filteredRequests = useMemo(() => {
    return initialRequests
      .filter((r) => {
        const rStatus = normStatus(r.status);
        const matchesStatus =
          activeStatusFilters.size === 0
            ? true
            : activeStatusFilters.has(rStatus);
        const q = searchQuery.trim().toLowerCase();
        return (
          matchesStatus &&
          (q === "" ||
            (r.group_name || "").toLowerCase().includes(q) ||
            (r.booker_name || "").toLowerCase().includes(q) ||
            (r.genre || "").toLowerCase().includes(q) ||
            (r.type || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Sort: pipeline order (new → declined), then by created_at desc
        const statusOrder: Record<string, number> = {
          new: 0,
          reviewing: 1,
          offered: 2,
          booked: 3,
          declined: 4,
        };
        const sa = statusOrder[normStatus(a.status)] ?? 5;
        const sb = statusOrder[normStatus(b.status)] ?? 5;
        if (sa !== sb) return sa - sb;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [initialRequests, activeStatusFilters, searchQuery]);

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

      {/* Cards */}
      <div className="space-y-2 pb-2">
        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E6DFC8] bg-white py-16 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-[#5F624F]/50" />
            <p className="text-sm font-medium text-[#5F624F]">
              No band applications found
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => (
            <BandBookingCard key={req.id} request={req} />
          ))
        )}
      </div>
    </div>
  );
}
