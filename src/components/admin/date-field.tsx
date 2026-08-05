"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Dates come back as plain YYYY-MM-DD, which parses as UTC midnight and can slip
// a day west of Greenwich. Anchoring to local midnight keeps the day right.
export function parseRecordDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value}T00:00:00`);
}

export function formatRecordDate(value?: string | null): string {
  if (!value) return "-";
  const date = parseRecordDate(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = parseRecordDate(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
}

// A native date input renders the browser's own locale format and ignores
// text-align, so a form would read 26/07/2025 hard left while the record beside
// it reads 26 Jul 2025 hard right. This keeps both sides identical.
export function DateField({
  name,
  label,
  value,
  onChange,
  clearable = true,
  placeholder = "Pick a date",
}: {
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  clearable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 justify-end">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="flex cursor-pointer items-center gap-2 bg-transparent text-sm transition-colors hover:text-admin-primary"
          >
            {/* An empty date reads as a prompt, not a value - same weight and
                colour as the record id in the header. */}
            <span
              className={cn(
                value ? "font-semibold text-admin-ink" : "font-normal text-admin-muted",
              )}
            >
              {value ? formatRecordDate(value) : placeholder}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-admin-muted/60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card p-0"
        >
          <Calendar
            mode="single"
            selected={value ? parseRecordDate(value) : undefined}
            onSelect={(picked) => {
              onChange(picked ? format(picked, "yyyy-MM-dd") : "");
              setOpen(false);
            }}
            autoFocus
          />
          {clearable && value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full border-t border-admin-line px-4 py-2.5 text-[12px] font-semibold text-admin-error hover:bg-admin-error-bg"
            >
              Clear date
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
