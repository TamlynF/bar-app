"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { saveEventNormalUnitsAction } from "../actions";

export type NormalUnitsRowView = {
  menuItemPriceId: number;
  name: string;
  serve: string;
  linked: boolean;
  override: number | null;
  byWeekday: { weekday: number; unitsAvg: number; nightsSampled: number }[];
};

export type NormalUnitsView = {
  eventId: number;
  weekdays: number[];
  computedAt: string | null;
  /* When the nightly Square sync last ran; null when it never has. */
  salesSyncedAt: string | null;
  rows: NormalUnitsRowView[];
};

/* The normal units per night worked out from Square history, one figure
   per weekday the event runs on, with how many nights were sampled. */
export function NormalUnitsCell({
  row,
  weekdays,
  className,
}: {
  row: NormalUnitsRowView;
  weekdays: number[];
  className?: string;
}) {
  if (weekdays.length === 0) return <span className="text-admin-muted">-</span>;
  const showDay = weekdays.length > 1;
  return (
    <span className={cn("inline-flex flex-col tabular-nums", className)}>
      {weekdays.map((day) => {
        const cell = row.byWeekday.find((c) => c.weekday === day);
        const dayName = WEEKDAY_NAMES[day];
        return (
          <span
            key={day}
            className="whitespace-nowrap"
            title={
              cell
                ? `${cell.unitsAvg.toFixed(1)} a night on ${dayName}s, over ${cell.nightsSampled} ${cell.nightsSampled === 1 ? "night" : "nights"}`
                : `No Square sales on ${dayName}s worked out yet`
            }
          >
            {showDay && <span className="mr-1 text-[11px] text-admin-muted">{dayName.slice(0, 3)}</span>}
            {cell ? (
              <>
                <span className="font-semibold text-admin-ink">{cell.unitsAvg.toFixed(1)}</span>
                <span className="ml-1 text-[11px] text-admin-muted">/{cell.nightsSampled}n</span>
              </>
            ) : (
              <span className="text-admin-muted">-</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function NormalUnitsOverrideInput({
  eventId,
  row,
  className,
}: {
  eventId: number;
  row: NormalUnitsRowView;
  className?: string;
}) {
  const [value, setValue] = useState(row.override?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function commit(raw: string) {
    setValue(raw);
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === row.override || (next === null && row.override === null)) return;
    startTransition(async () => {
      const result = await saveEventNormalUnitsAction(eventId, row.menuItemPriceId, next);
      if ("error" in result) toast.error(result.error);
      else toast.success(next === null ? "Using Square history." : "Override saved.");
    });
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      disabled={isPending}
      aria-label={`Override normal units per night for ${row.name} ${row.serve}`}
      title="Replaces the Square history figure for this drink; leave blank to use history"
      placeholder="auto"
      className={cn(
        "h-9 w-20 rounded-lg border border-admin-line bg-admin-card px-2 text-right text-[13px] font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  );
}
