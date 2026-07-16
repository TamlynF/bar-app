"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { badgeClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { cardIcon } from "@/lib/booking-card-icons";
import type { AdminBookingGroup } from "@/lib/admin-booking-groups";

export default function BookingsHubClient({ groups }: { groups: AdminBookingGroup[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        (g.typeLabel?.toLowerCase().includes(q) ?? false)
    );
  }, [groups, query]);

  return (
    <div className="space-y-4 p-2 sm:p-8">
      {/* Search */}
      <div className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#E6DFC8] bg-white px-3 transition-colors focus-within:border-[#5C4033]">
        <Search className="h-4 w-4 shrink-0 text-[#5F624F]/50" />
        <input
          type="text"
          placeholder="Search bookings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search bookings"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/40"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-[#5F624F]/70">
          No bookings found.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((group) => {
            const badgeClasses = badgeClassFromColor(group.badgeColor);
            const colorHex = swatchHexFromColor(group.badgeColor) ?? "#5C4033";
            const Icon = cardIcon(group.icon);
            return (
              <Link
                key={group.key}
                href={group.href}
                className="group flex items-center justify-between rounded-3xl border border-[#E6DFC8] bg-white p-3 shadow-sm transition-all hover:border-[#5C4033] hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div
                    style={{ "--cc": colorHex } as React.CSSProperties}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--cc)/15 transition-transform group-hover:scale-110"
                  >
                    <Icon className="h-6 w-6 text-(--cc)" />
                  </div>
                  <div className="flex min-w-0 flex-col text-left">
                    <span className="truncate font-black leading-none tracking-tight text-[#1F1F1A] uppercase">
                      {group.label}
                    </span>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {group.typeLabel && (
                        <span className="text-[11px] font-bold tracking-wider text-[#5F624F] uppercase opacity-60">
                          {group.typeLabel}
                        </span>
                      )}
                      <span className={`rounded px-1.5 py-0.5 font-black text-[9px] tracking-wide uppercase ${badgeClasses}`}>
                        {group.count} upcoming
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#E6DFC8] transition-colors group-hover:text-[#5C4033]" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
