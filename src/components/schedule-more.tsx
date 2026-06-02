"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink } from "lucide-react";

/**
 * Client island for the "View [next month]" reveal on the home schedule.
 *
 * The server component (page.tsx) does all fetching, bucketing and colour
 * brightening, then passes the already-computed next-month events here. This
 * component only owns the show/hide state — keeping the "use client" surface
 * as small as possible per CLAUDE.md.
 */

type LaterEvent = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  startTimeLabel: string | null;
  externalLink: string | null;
  color: string; // brightened event-type colour
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

  if (events.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center justify-center gap-2 bg-white/4 hover:bg-white/7 border border-white/10 hover:border-[#FDCC4B]/30 rounded-2xl py-3.5 transition-all"
      >
        <span className="text-[#FDCC4B] text-[11px] font-black uppercase tracking-[0.2em]">
          {open ? `Hide ${nextMonthLabel}` : `View ${nextMonthLabel}`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#FDCC4B] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 bg-white/3 border border-white/8 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {events.map((ev) => {
            const dateObj = parseDate(ev.date);
            const inner = (
              <div className="flex items-center gap-3 px-4 py-4 hover:bg-white/4 transition-colors">
                <span
                  className="ev-dot shrink-0 w-2 h-2 rounded-full"
                  style={{ "--ev-c": ev.color } as React.CSSProperties}
                />
                <div className="shrink-0 w-12">
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest leading-tight">
                    {format(dateObj, "EEE")}
                  </p>
                  <p className="text-white text-base font-black tabular-nums leading-none">
                    {format(dateObj, "d")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="ev-text text-sm font-black leading-tight truncate"
                    style={{ "--ev-c": ev.color } as React.CSSProperties}
                  >
                    {ev.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ev.subType && (
                      <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wide truncate">
                        {ev.subType}
                      </span>
                    )}
                    {ev.startTimeLabel && (
                      <span className="text-stone-400 text-xs font-bold tabular-nums shrink-0">
                        {ev.startTimeLabel}
                      </span>
                    )}
                  </div>
                </div>
                {ev.externalLink && (
                  <ExternalLink className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                )}
              </div>
            );

            return ev.externalLink ? (
              <a key={ev.id} href={ev.externalLink} target="_blank" rel="noopener noreferrer">
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