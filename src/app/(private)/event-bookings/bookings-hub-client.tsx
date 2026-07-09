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
      <div className="flex items-center gap-2 bg-white px-3 border border-[#E6DFC8] focus-within:border-[#5C4033] rounded-xl min-w-0 h-11 transition-colors">
        <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
        <input
          type="text"
          placeholder="Search bookings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search bookings"
          className="flex-1 bg-transparent outline-none min-w-0 text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-8 text-[#5F624F]/70 text-sm text-center">
          No bookings found.
        </p>
      ) : (
        <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
          {filtered.map((group) => {
            const badgeClasses = badgeClassFromColor(group.badgeColor);
            const colorHex = swatchHexFromColor(group.badgeColor) ?? "#5C4033";
            const Icon = cardIcon(group.icon);
            return (
              <Link
                key={group.key}
                href={group.href}
                className="group flex justify-between items-center bg-white shadow-sm hover:shadow-md p-3 border border-[#E6DFC8] hover:border-[#5C4033] rounded-3xl active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    style={{ "--cc": colorHex } as React.CSSProperties}
                    className="flex items-center justify-center w-12 h-12 bg-(--cc)/15 rounded-2xl transition-transform shrink-0 group-hover:scale-110"
                  >
                    <Icon className="w-6 h-6 text-(--cc)" />
                  </div>
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="font-black text-[#1F1F1A] truncate uppercase leading-none tracking-tight">
                      {group.label}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {group.typeLabel && (
                        <span className="opacity-60 font-bold text-[#5F624F] text-[11px] uppercase tracking-wider">
                          {group.typeLabel}
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeClasses}`}>
                        {group.count} upcoming
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#E6DFC8] group-hover:text-[#5C4033] transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
