"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["S", "M", "T", "W", "T", "F", "S"];

export type DateRange = { start: string; end: string | null };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function fmtShort(iso: string) {
  const dt = new Date(iso + "T00:00:00");
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** Human label for a range value (null = no filter). */
export function dateRangeLabel(range: DateRange | null): string {
  if (!range || !range.start) return "All dates";
  if (!range.end || range.end === range.start) return fmtShort(range.start);
  return `${fmtShort(range.start)} – ${fmtShort(range.end)}`;
}

/**
 * Date / date-range filter. Tap once to pick a single day, tap a second day to
 * extend into a range. Value is `{ start, end }` (YYYY-MM-DD; `end` null = single
 * day) or `null` for no date filter. Built on the shared Popover so it matches
 * the rest of the admin surface.
 */
export function DatePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = value?.start ? new Date(value.start + "T00:00:00") : new Date();
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [draft, setDraft] = useState<DateRange>(value?.start ? value : { start: "", end: null });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const startDow = new Date(view.y, view.m, 1).getDay();

  const tapDay = (d: number) => {
    const v = toISO(view.y, view.m, d);
    if (!draft.start || draft.end || v < draft.start) setDraft({ start: v, end: null });
    else setDraft({ start: draft.start, end: v });
  };

  // 0 = outside, 1 = inside range, 2 = endpoint
  const rangeOf = (d: number) => {
    const v = toISO(view.y, view.m, d);
    if (!draft.start) return 0;
    if (!draft.end) return v === draft.start ? 2 : 0;
    if (v === draft.start || v === draft.end) return 2;
    return v > draft.start && v < draft.end ? 1 : 0;
  };

  const shift = (dir: number) =>
    setView((v) => {
      let m = v.m + dir;
      let y = v.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });

  const summary = !draft.start
    ? "Pick a date"
    : draft.end && draft.end !== draft.start
      ? `${fmtShort(draft.start)} → ${fmtShort(draft.end)}`
      : `${fmtShort(draft.start)} · single day`;

  const apply = () => {
    onChange(draft.start ? draft : null);
    setOpen(false);
  };
  const clear = () => {
    setDraft({ start: "", end: null });
    onChange(null);
    setOpen(false);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const active = !!value?.start;
  const todayISO = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value?.start ? value : { start: "", end: null });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Filter by date"
          className={cn(
            "h-11 px-3 inline-flex items-center gap-2 rounded-xl border text-xs font-bold outline-none transition-colors shrink-0",
            active
              ? "bg-[#5C4033] text-white border-[#5C4033]"
              : "bg-transparent text-[#1F1F1A] border-[#E6DFC8] hover:border-[#5C4033] focus:border-[#5C4033]",
            className
          )}
        >
          <CalendarIcon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-white/80" : "text-[#5F624F]/60")} />
          {dateRangeLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 bg-white border-2 border-[#E6DFC8] rounded-2xl">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => shift(-1)} title="Previous month" className="h-8 w-8 rounded-lg hover:bg-[#F7F4EA] flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-[#5C4033]" />
          </button>
          <span className="text-sm font-black text-[#1F1F1A] uppercase tracking-wide tabular-nums">{MONTHS[view.m]} {view.y}</span>
          <button type="button" onClick={() => shift(1)} title="Next month" className="h-8 w-8 rounded-lg hover:bg-[#F7F4EA] flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-[#5C4033]" />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {WD.map((w, i) => (
            <span key={i} className="text-center text-[10px] font-black uppercase tracking-wide text-[#5F624F] py-1">{w}</span>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d == null) return <span key={i} className="aspect-square" />;
            const r = rangeOf(d);
            const iso = toISO(view.y, view.m, d);
            const isToday = iso === todayISO;
            return (
              <button
                key={i}
                type="button"
                onClick={() => tapDay(d)}
                className={cn(
                  "aspect-square rounded-lg text-xs font-black flex items-center justify-center transition-colors",
                  r === 2 && "bg-[#5C4033] text-white",
                  r === 1 && "bg-[#5C4033]/15 text-[#5C4033] rounded-none",
                  r === 0 && "text-[#1F1F1A] hover:bg-[#F7F4EA]",
                  isToday && r === 0 && "ring-1 ring-inset ring-[#FF6B35]"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] font-black text-[#5C4033] mt-3 mb-2">{summary}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <button type="button" onClick={clear} className="flex-1 h-9 rounded-lg border border-[#E6DFC8] text-[10px] font-black uppercase tracking-wide text-[#5F624F] hover:bg-[#F7F4EA]">
            All dates
          </button>
          <button type="button" onClick={apply} className="flex-1 h-9 rounded-lg bg-[#5C4033] text-white text-[10px] font-black uppercase tracking-wide hover:bg-[#5C4033]/85">
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
