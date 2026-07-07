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
    const getCount = (list: BandRequest[]) => list.length;
    return {
      total: getCount(initialRequests),
      confirmed: getCount(
        initialRequests.filter((r) => normStatus(r.status) === "confirmed")
      ),
      pending: getCount(
        initialRequests.filter((r) => normStatus(r.status) === "pending")
      ),
      cancelled: getCount(
        initialRequests.filter((r) => normStatus(r.status) === "cancelled")
      ),
    };
  }, [initialRequests]);

  return (
    <div className="space-y-3 animate-in duration-500 fade-in">
      {/* Stats + Search grouped card */}
      <div className="bg-white shadow-sm border border-[#E6DFC8] rounded-2xl">
        <div className="flex sm:flex-row flex-col items-center">
          {/* Stats Bar */}
          <div className="sm:flex-1 px-2 pt-2 sm:pt-0 overflow-x-auto no-scrollbar">
            <div className="flex sm:justify-evenly items-stretch gap-3 sm:gap-0 px-2 py-3 w-full min-w-max sm:min-w-0">
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
          <div className="sm:hidden mx-3 border-[#E6DFC8] border-t" />
          <div className="hidden sm:block self-stretch bg-[#E6DFC8] my-2 w-px" />

          {/* Search */}
          <div className="flex justify-center mb-3 sm:mb-0 px-3 sm:px-4 py-2 shrink-0">
            <div className="flex items-center gap-3 px-4 border border-[#E6DFC8] focus-within:border-[#5C4033] rounded-xl w-full sm:w-56 max-w-sm h-10 transition-colors">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Search bands, genres..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="flex-1 bg-transparent outline-none min-w-0 placeholder:font-normal text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm placeholder:normal-case placeholder:tracking-normal"
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
                  className="hover:bg-[#E6DFC8] p-1 rounded-lg transition-colors shrink-0"
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
          <div className="bg-white py-16 border border-[#E6DFC8] border-dashed rounded-2xl text-center">
            <Inbox className="mx-auto mb-3 w-10 h-10 text-[#5F624F]/50" />
            <p className="font-medium text-[#5F624F] text-sm">
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
