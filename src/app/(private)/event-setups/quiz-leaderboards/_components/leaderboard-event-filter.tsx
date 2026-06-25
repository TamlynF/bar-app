"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { LeaderboardEvent } from "../actions";

// DB stores `date` as YYYY-MM-DD — anchor to local midnight (see CLAUDE.md).
const parseDate = (d: string) => new Date(d + "T00:00:00");

export default function LeaderboardEventFilter({
  events,
  selectedEventId,
}: {
  events: LeaderboardEvent[];
  selectedEventId: string | null;
}) {
  const router = useRouter();

  const label = (e: LeaderboardEvent) =>
    `${format(parseDate(e.date), "dd MMM yyyy")}${e.title ? ` — ${e.title}` : ""}`;

  return (
    <div className="relative w-full sm:w-80">
      <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C4033] pointer-events-none" />
      <select
        aria-label="Select quiz event"
        value={selectedEventId ?? ""}
        onChange={(e) => router.push(`/event-setups/quiz-leaderboards?event=${encodeURIComponent(e.target.value)}`)}
        className="w-full h-11 rounded-xl bg-white border border-[#E6DFC8] pl-10 pr-9 text-sm font-bold text-[#1F1F1A] appearance-none outline-none focus:border-[#5C4033] transition-colors"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {label(e)}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F624F] pointer-events-none" />
    </div>
  );
}
