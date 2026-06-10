"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Month-only picker (one month at a time). Replaces `input[type=month]`, which
 * is unsupported in Firefox/Safari. Value is a "YYYY-MM" string ("" = all months).
 */
export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedYear = value ? parseInt(value.slice(0, 4), 10) : new Date().getFullYear();
  const selectedMonth = value ? parseInt(value.slice(5, 7), 10) - 1 : -1; // 0-11
  const [viewYear, setViewYear] = useState(selectedYear);

  const label = value ? format(new Date(value + "-01T00:00:00"), "MMM yyyy") : "All months";

  const pick = (monthIdx: number) => {
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setViewYear(selectedYear);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Filter by month"
          className={cn(
            "h-11 px-3 inline-flex items-center gap-2 rounded-xl border border-[#E6DFC8] text-xs font-bold text-[#1F1F1A] bg-transparent outline-none hover:border-[#5C4033] focus:border-[#5C4033] transition-colors shrink-0",
            className
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-[#5F624F]/60 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 bg-white border-2 border-[#E6DFC8] rounded-2xl">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            title="Previous year"
            className="h-8 w-8 rounded-lg hover:bg-[#F7F4EA] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-[#5C4033]" />
          </button>
          <span className="text-sm font-black text-[#1F1F1A] tabular-nums">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            title="Next year"
            className="h-8 w-8 rounded-lg hover:bg-[#F7F4EA] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-[#5C4033]" />
          </button>
        </div>

        {/* Month grid — one month at a time */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const isSelected = i === selectedMonth && viewYear === selectedYear;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "h-10 rounded-lg text-[11px] font-black uppercase tracking-wide transition-colors",
                  isSelected ? "bg-[#5C4033] text-white" : "text-[#5C4033] hover:bg-[#F7F4EA]"
                )}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* Clear → all months */}
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="mt-2 w-full h-9 rounded-lg border border-[#E6DFC8] text-[10px] font-black uppercase tracking-wide text-[#5F624F] hover:bg-[#F7F4EA]"
        >
          All months
        </button>
      </PopoverContent>
    </Popover>
  );
}
