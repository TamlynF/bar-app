"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { saveEventNormalUnitsAction, saveEventNormalUnitsKeepAction } from "../actions";
import { Switch } from "./switch-field";

export type NormalUnitsRowView = {
  menuItemPriceId: number;
  name: string;
  serve: string;
  linked: boolean;
  override: number | null;
  /* Whether the override outlives the next market night. */
  keep: boolean;
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

/* An event on three or more weekdays would stack a line per day in every
   row, so from here the cell shows its busiest day and opens to the rest. */
const COMPACT_FROM = 3;

function nightsLabel(nights: number): string {
  return `${nights} ${nights === 1 ? "night" : "nights"}`;
}

function NormalUnitsSummary({
  row,
  weekdays,
  className,
}: {
  row: NormalUnitsRowView;
  weekdays: number[];
  className?: string;
}) {
  const days = weekdays.map((day) => ({ day, cell: row.byWeekday.find((c) => c.weekday === day) }));
  const withData = days.filter((entry) => entry.cell);
  const peak = withData.reduce<(typeof days)[number] | null>(
    (best, entry) => (!best || entry.cell!.unitsAvg > best.cell!.unitsAvg ? entry : best),
    null
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Normal units a night by weekday for ${row.name} ${row.serve}`}
          className={cn(
            "inline-flex min-h-11 flex-col items-end justify-center rounded-lg px-1.5 tabular-nums transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:min-h-9",
            className
          )}
        >
          {peak?.cell ? (
            <span className="whitespace-nowrap">
              <span className="mr-1 text-[11px] text-admin-muted">{WEEKDAY_NAMES[peak.day].slice(0, 3)}</span>
              <span className="font-semibold text-admin-ink">{peak.cell.unitsAvg.toFixed(1)}</span>
              <span className="ml-1 text-[11px] text-admin-muted">/{peak.cell.nightsSampled}n</span>
            </span>
          ) : (
            <span className="text-admin-muted">-</span>
          )}
          <span className="text-[11px] whitespace-nowrap text-admin-muted underline decoration-dotted underline-offset-2">
            {withData.length} of {weekdays.length} days
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-60 rounded-2xl border-admin-line bg-admin-card p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="border-b border-admin-line px-4 py-2.5 text-[13px] font-bold text-admin-ink">
          Normal units a night
          <span className="block text-[11px] font-medium text-admin-muted">
            From Square sales; the market uses the day it opens on.
          </span>
        </p>
        <ul className="m-0 list-none divide-y divide-admin-line/60 p-0">
          {days.map(({ day, cell }) => (
            <li
              key={day}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-1.5 text-[12px]",
                peak?.day === day && "bg-admin-primary-soft"
              )}
            >
              <span className="text-admin-ink">{WEEKDAY_NAMES[day]}</span>
              {cell ? (
                <span className="tabular-nums">
                  <span className="font-semibold text-admin-ink">{cell.unitsAvg.toFixed(1)}</span>
                  <span className="ml-1.5 text-[11px] text-admin-muted">over {nightsLabel(cell.nightsSampled)}</span>
                </span>
              ) : (
                <span className="text-admin-muted">No sales yet</span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

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
  if (weekdays.length >= COMPACT_FROM) return <NormalUnitsSummary row={row} weekdays={weekdays} className={className} />;
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
  const router = useRouter();
  const [value, setValue] = useState(row.override?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function commit(raw: string) {
    setValue(raw);
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === row.override || (next === null && row.override === null)) return;
    startTransition(async () => {
      const result = await saveEventNormalUnitsAction(eventId, row.menuItemPriceId, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(next === null ? "Using Square history." : "Override saved.");
      router.refresh();
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

/* The board's "keep for future nights" switch for a drink's normal units
   override, saved as soon as it flips. A drink on auto has nothing to keep. */
export function NormalUnitsKeepSwitch({
  eventId,
  row,
  className,
}: {
  eventId: number;
  row: NormalUnitsRowView;
  className?: string;
}) {
  const router = useRouter();
  const [keep, setKeep] = useState(row.keep);
  const [isPending, startTransition] = useTransition();
  if (row.override == null) return <span className="text-admin-muted">-</span>;

  function change(next: boolean) {
    setKeep(next);
    startTransition(async () => {
      const result = await saveEventNormalUnitsKeepAction(eventId, row.menuItemPriceId, next);
      if ("error" in result) {
        setKeep(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Override kept for future nights." : "Override goes back to auto after the next night.");
      router.refresh();
    });
  }

  return (
    <Switch
      checked={keep}
      onChange={change}
      disabled={isPending}
      label={`Keep the normal units override for ${row.name} ${row.serve} for future nights`}
      className={className}
    />
  );
}
