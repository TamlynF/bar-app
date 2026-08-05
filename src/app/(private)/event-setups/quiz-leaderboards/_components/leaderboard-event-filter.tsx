"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [unrecordedOnly, setUnrecordedOnly] = useState(false);

  const missing = useMemo(() => events.filter((e) => !e.hasWinner), [events]);

  // The event being looked at stays in the list whatever the filter says, so the
  // select always has the option it is showing - recording its winner would
  // otherwise make the page jump to a different quiz mid-click.
  const shown = useMemo(() => {
    if (!unrecordedOnly) return events;
    return events.filter((e) => !e.hasWinner || e.id === selectedEventId);
  }, [events, unrecordedOnly, selectedEventId]);

  const label = (e: LeaderboardEvent) =>
    `${format(parseDate(e.date), "dd MMM yyyy")}${e.title ? ` - ${e.title}` : ""}${
      e.hasWinner ? "" : " - no winner"
    }`;

  const go = (id: string) =>
    router.push(`/event-setups/quiz-leaderboards?event=${encodeURIComponent(id)}`);

  const jumpToFirstMissing = () => {
    setUnrecordedOnly(true);
    const next = missing.find((e) => e.id !== selectedEventId) ?? missing[0];
    if (next && next.id !== selectedEventId) go(next.id);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {missing.length > 0 && (
        <button
          type="button"
          onClick={() => (unrecordedOnly ? setUnrecordedOnly(false) : jumpToFirstMissing())}
          aria-pressed={unrecordedOnly}
          title={
            unrecordedOnly
              ? "Show every past quiz"
              : "Show only past quizzes with no winner recorded"
          }
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors sm:h-11",
            unrecordedOnly
              ? "border-admin-warning/40 bg-admin-warning-bg text-admin-warning"
              : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:bg-admin-primary-soft hover:text-admin-primary",
          )}
        >
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {missing.length} need{missing.length === 1 ? "s" : ""} a winner
        </button>
      )}

      <div className="relative w-full sm:w-80">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-admin-primary" />
        <select
          aria-label="Select quiz event"
          value={selectedEventId ?? ""}
          onChange={(e) => go(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-admin-line bg-admin-card pr-9 pl-10 text-sm font-semibold text-admin-ink transition-colors outline-none focus:border-admin-primary"
        >
          {shown.map((e) => (
            <option key={e.id} value={e.id}>
              {label(e)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-admin-muted" />
      </div>
    </div>
  );
}
