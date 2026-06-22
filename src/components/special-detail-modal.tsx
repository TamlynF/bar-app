"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { X, CalendarDays } from "lucide-react";
import { RichTextContent } from "@/components/rich-text-content";
import { cn } from "@/lib/utils";
import type { SpecialRow } from "@/components/specials-section";

/** ISO weekday numbers (1=Mon … 7=Sun) and short labels for the day pills. */
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

/**
 * Detail view for a single special — opened by tapping a special on the home
 * page. Surfaces the things a customer asks about: when it runs (start/end),
 * which days of the week it's on, and the full terms. Bottom sheet on mobile,
 * centred dialog on desktop. Closes on backdrop click and Escape.
 */
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
      className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={special.title}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[#26300D] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur transition-colors"
        >
          <X className="w-4.5 h-4.5" aria-hidden="true" />
        </button>

        {/* Image */}
        {special.image_url && (
          <div className="w-full h-48 border-b border-white/10 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={special.image_url}
              alt={special.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-5 sm:p-6">
          {special.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {special.badges.map((b) => (
                <span
                  key={b}
                  className="text-[10px] font-black uppercase tracking-wide text-[#1a2008] bg-[#FDCC4B] px-2.5 py-1 rounded-md"
                >
                  {b}
                </span>
              ))}
            </div>
          )}

          <h3 className="text-white font-black uppercase tracking-tighter leading-[0.95] text-2xl sm:text-3xl">
            {special.title}
          </h3>

          {special.description && (
            <div className="mt-2.5 text-sm">
              <RichTextContent html={special.description} variant="public" />
            </div>
          )}

          {/* Runs */}
          {dateRange && (
            <div className="mt-5 flex items-center gap-3 bg-[#1a2008]/60 border border-white/10 rounded-2xl px-4 py-3">
              <CalendarDays className="w-4 h-4 text-[#FDCC4B] shrink-0" aria-hidden="true" />
              <span className="text-stone-400 text-[11px] font-black uppercase tracking-[0.1em]">
                Runs
              </span>
              <span className="ml-auto text-white text-sm font-bold tabular-nums">
                {dateRange}
              </span>
            </div>
          )}

          {/* Available on */}
          <p className="mt-5 mb-2 text-stone-400 text-[10px] font-black uppercase tracking-[0.16em]">
            Available on{everyDay && " · every day"}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = everyDay || days.includes(d.value);
              return (
                <span
                  key={d.value}
                  className={cn(
                    "text-center py-2 rounded-lg text-[11px] font-black uppercase tracking-wide border",
                    on
                      ? "text-[#1a2008] bg-[#FDCC4B] border-[#FDCC4B]"
                      : "text-stone-500 bg-white/5 border-white/10"
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
            className="mt-6 w-full h-12 rounded-xl bg-[#FDCC4B] text-[#1a2008] text-sm font-black uppercase tracking-wide hover:bg-[#e5b843] active:scale-95 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
