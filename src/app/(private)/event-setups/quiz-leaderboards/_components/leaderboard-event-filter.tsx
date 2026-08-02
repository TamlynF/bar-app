"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { LeaderboardEvent } from "../actions";

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
    `${format(parseDate(e.date), "dd MMM yyyy")}${e.title ? ` - ${e.title}` : ""}`;

  return (
    <div className="relative w-full sm:w-80">
      <CalendarDays className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#34451F]" />
      <select
        aria-label="Select quiz event"
        value={selectedEventId ?? ""}
        onChange={(e) => router.push(`/event-setups/quiz-leaderboards?event=${encodeURIComponent(e.target.value)}`)}
        className="h-11 w-full appearance-none rounded-xl border border-[#D8D5C8] bg-white pr-9 pl-10 text-sm font-bold text-[#20231A] transition-colors outline-none focus:border-[#34451F]"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {label(e)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#5E6654]" />
    </div>
  );
}
