"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { X, CalendarDays } from "lucide-react";
import { RichTextContent } from "@/components/rich-text-content";
import { cn } from "@/lib/utils";
import type { SpecialRow } from "@/components/specials-section";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM yyyy");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function SpecialDetailModal({
  special,
  onClose,
}: {
  special: SpecialRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dateRange = formatDateRange(special.start_date, special.end_date);
  const days = special.days_of_week ?? [];
  const everyDay = days.length === 0;

  return (
    <div
      className="fixed inset-0 z-80 flex animate-in items-end justify-center bg-black/70 backdrop-blur-sm duration-200 fade-in sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={special.title}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full animate-in overflow-y-auto rounded-t-3xl border border-hairline bg-[#1b210f] shadow-2xl shadow-black/60 duration-300 slide-in-from-bottom-4 sm:max-w-md sm:rounded-3xl sm:zoom-in-95"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3.5 right-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-ink backdrop-blur transition-colors hover:bg-black/70"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        {special.image_url && (
          <div className="h-48 w-full overflow-hidden border-b border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={special.image_url}
              alt={special.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-5 sm:p-6">
          {special.badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {special.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-md bg-[#FDCC4B] px-2.5 py-1 font-black text-[10px] tracking-wide text-[#1a2008] uppercase"
                >
                  {b}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-black text-2xl leading-[0.95] tracking-tighter text-ink uppercase sm:text-3xl">
            {special.title}
          </h3>

          {special.description && (
            <div className="mt-2.5 text-sm">
              <RichTextContent html={special.description} variant="public" />
            </div>
          )}

          {dateRange && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-hairline bg-canvas/60 px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#FDCC4B]" aria-hidden="true" />
              <span className="font-black text-[11px] tracking-widest text-stone-400 uppercase">
                Runs
              </span>
              <span className="ml-auto text-sm font-bold text-ink tabular-nums">
                {dateRange}
              </span>
            </div>
          )}

          <p className="mt-5 mb-2 font-black text-[10px] tracking-[0.16em] text-stone-400 uppercase">
            Available on{everyDay && " · every day"}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = everyDay || days.includes(d.value);
              return (
                <span
                  key={d.value}
                  className={cn(
                    "rounded-lg border py-2 text-center font-black text-[11px] tracking-wide uppercase",
                    on
                      ? "border-[#FDCC4B] bg-[#FDCC4B] text-[#1a2008]"
                      : "border-hairline bg-canvas-2 text-stone-500"
                  )}
                >
                  {d.label}
                </span>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-xl bg-[#FDCC4B] font-black text-sm tracking-wide text-[#1a2008] uppercase transition-all hover:bg-[#e5b843] active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
