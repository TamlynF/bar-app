"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink } from "lucide-react";

/**
 * Client island for the "View more" reveal on the home schedule.
 *
 * The server component (page.tsx) does all the data fetching and bucketing,
 * then passes the already-computed "later events" (next month) into this
 * component. This component only owns the show/hide state — keeping the
 * `"use client"` surface as small as possible per CLAUDE.md.
 */

type LaterEvent = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  startTimeLabel: string | null;
  endTimeLabel: string | null;
    externalLink: string | null;
    isActive: boolean;
    isFullyBooked: boolean;
  isBookable: boolean;
  color: string; // event-type colour from badge_color
  type: string | null;
  subType: string | null;
};

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

export function ScheduleMore({
  events,
  nextMonthLabel,
}: {
  events: LaterEvent[];
  nextMonthLabel: string;
}) {
    const [open, setOpen] = useState(false);
    console.log("ScheduleMore events:", JSON.stringify(events, null, 2));

  if (events.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-[#FDCC4B]/30 rounded-2xl py-3.5 transition-all"
      >
        <span className="text-[#FDCC4B] text-[11px] font-black uppercase tracking-[0.2em]">
          {open ? `Hide ${nextMonthLabel}` : `View ${nextMonthLabel}`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#FDCC4B] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl divide-y divide-white/5 overflow-hidden">
          {events.map((ev) => {
            const dateObj = parseDate(ev.date);
            const inner = (
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <span
                  className="ev-dot shrink-0 w-2 h-2 rounded-full"
                  style={{ "--ev-c": ev.color } as React.CSSProperties}
                />
                <div className="shrink-0 w-14">
                  <p
                    className="ev-text text-[10px] font-black uppercase tracking-widest"
                    style={{ "--ev-c": ev.color } as React.CSSProperties}
                  >
                    {format(dateObj, "EEE")} {format(dateObj, "d")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="ev-text text-sm font-black truncate"
                    style={{ "--ev-c": ev.color } as React.CSSProperties}
                  >
                    {ev.title}
                  </span>
                  {ev.startTimeLabel && (
                    <span
                      className="ev-text text-xs font-bold ml-2 tabular-nums"
                      style={{ "--ev-c": ev.color } as React.CSSProperties}
                    >
                      {ev.startTimeLabel}
                    </span>
                  )}
                </div>
                {ev.externalLink && (
                  <ExternalLink className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                )}
              </div>
            );

            return ev.externalLink ? (
              <a
                key={ev.id}
                href={ev.externalLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={ev.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}