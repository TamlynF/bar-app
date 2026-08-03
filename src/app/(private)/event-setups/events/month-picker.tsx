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

export function dateRangeLabel(range: DateRange | null): string {
  if (!range || !range.start) return "All dates";
  if (!range.end || range.end === range.start) return fmtShort(range.start);
  return `${fmtShort(range.start)} – ${fmtShort(range.end)}`;
}

export function DatePicker({
  value,
  onChange,
  className,
  appearance = "primary",
}: {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  className?: string;
  appearance?: "primary" | "secondary";
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
  const secondary = appearance === "secondary";
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
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors outline-none",
            secondary
              ? active
                ? "border-[#B9C3A8] bg-[#E5EBD8] text-[#34451F] hover:bg-[#DCE4CE]"
                : "border-[#D8D5C8] bg-white text-[#34451F] hover:border-[#B9C3A8] hover:bg-[#F8F6EF] focus:border-[#34451F]"
              : active
                ? "border-[#34451F] bg-[#34451F] text-white"
                : "border-[#D8D5C8] bg-transparent text-[#20231A] hover:border-[#34451F] focus:border-[#34451F]",
            className
          )}
        >
          <CalendarIcon className={cn(
            "h-3.5 w-3.5 shrink-0",
            secondary ? "text-[#34451F]/70" : active ? "text-white/80" : "text-[#5E6654]/60"
          )} />
          {dateRangeLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl border-2 border-[#D8D5C8] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} title="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F4F1E8]">
            <ChevronLeft className="h-4 w-4 text-[#34451F]" />
          </button>
          <span className="font-black text-sm tracking-wide text-[#20231A] uppercase tabular-nums">{MONTHS[view.m]} {view.y}</span>
          <button type="button" onClick={() => shift(1)} title="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F4F1E8]">
            <ChevronRight className="h-4 w-4 text-[#34451F]" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7">
          {WD.map((w, i) => (
            <span key={i} className="py-1 text-center font-black text-[10px] tracking-wide text-[#5E6654] uppercase">{w}</span>
          ))}
        </div>

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
                  "flex aspect-square items-center justify-center rounded-lg font-black text-xs transition-colors",
                  r === 2 && "bg-[#34451F] text-white",
                  r === 1 && "rounded-none bg-[#34451F]/15 text-[#34451F]",
                  r === 0 && "text-[#20231A] hover:bg-[#F4F1E8]",
                  isToday && r === 0 && "ring-1 ring-[#FF6B35] ring-inset"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>

        <p className="mt-3 mb-2 text-center font-black text-[11px] text-[#34451F]">{summary}</p>

        <div className="flex gap-2">
          <button type="button" onClick={clear} className="h-9 flex-1 rounded-lg border border-[#D8D5C8] font-black text-[10px] tracking-wide text-[#5E6654] uppercase hover:bg-[#F4F1E8]">
            All dates
          </button>
          <button type="button" onClick={apply} className="h-9 flex-1 rounded-lg bg-[#34451F] font-black text-[10px] tracking-wide text-white uppercase hover:bg-[#283719]">
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
