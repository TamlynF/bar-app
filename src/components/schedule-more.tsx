"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink } from "lucide-react";


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
        className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/4 py-3.5 transition-all hover:border-[#FDCC4B]/30 hover:bg-white/7"
      >
        <span className="font-black text-[11px] tracking-[0.2em] text-[#FDCC4B] uppercase">
          {open ? `Hide ${nextMonthLabel}` : `View ${nextMonthLabel}`}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#FDCC4B] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-white/3">
          {events.map((ev) => {
            const dateObj = parseDate(ev.date);
            const inner = (
              <div className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/4">
                <span
                  className="ev-dot h-2 w-2 shrink-0 rounded-full"
                  style={{ "--ev-c": ev.color } as React.CSSProperties}
                />
                <div className="w-12 shrink-0">
                  <p className="font-black text-[10px] leading-tight tracking-widest text-stone-500 uppercase">
                    {format(dateObj, "EEE")}
                  </p>
                  <p className="font-black text-base leading-none text-white tabular-nums">
                    {format(dateObj, "d")}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="ev-text truncate font-black text-sm leading-tight"
                    style={{ "--ev-c": ev.color } as React.CSSProperties}
                  >
                    {ev.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {ev.subType && (
                      <span className="truncate text-[10px] font-bold tracking-wide text-stone-500 uppercase">
                        {ev.subType}
                      </span>
                    )}
                    {ev.startTimeLabel && (
                      <span className="shrink-0 text-xs font-bold text-stone-400 tabular-nums">
                        {ev.startTimeLabel}
                      </span>
                    )}
                  </div>
                </div>
                {ev.externalLink && (
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-600" />
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