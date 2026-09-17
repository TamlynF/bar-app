"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { saveEventNormalUnitsAction } from "../actions";
import { NEUTRAL_BUTTON, OUTLINE_BUTTON, formatShortStamp } from "../ui";

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

function OverrideInput({ eventId, row }: { eventId: number; row: NormalUnitsRowView }) {
  const [value, setValue] = useState(row.override?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function commit() {
    const trimmed = value.trim();
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
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      disabled={isPending}
      aria-label={`Override normal units per night for ${row.name} ${row.serve}`}
      placeholder="auto"
      className="h-9 w-20 rounded-lg border border-admin-line bg-admin-card px-2 text-right text-[13px] font-semibold text-admin-ink tabular-nums outline-none focus:border-admin-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function subtitle(view: NormalUnitsView): string {
  if (view.weekdays.length === 0) return "Pick which day(s) this event runs on to work out normal sales.";
  const synced = view.salesSyncedAt
    ? `Sales synced from Square ${formatShortStamp(view.salesSyncedAt)}`
    : "Sales not synced from Square yet";
  const computed = view.computedAt ? `worked out ${formatShortStamp(view.computedAt)}` : "not worked out yet";
  return `${synced} · ${computed}`;
}

/* Per-drink "normal" figures the tier engine ranks against, worked out from
   the synced Square order lines. Folded once they exist, since after that
   the checklist above carries the state and this is only opened to check a
   figure or override one. */
export default function NormalUnitsCard({
  view,
  defaultOpen,
  reading,
  syncing,
  onRecalculate,
  onSync,
}: {
  view: NormalUnitsView;
  defaultOpen: boolean;
  reading: boolean;
  syncing: boolean;
  onRecalculate: () => void;
  onSync: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const weekdays = view.weekdays;
  const busy = reading || syncing;

  return (
    <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
      <div className={cn("flex flex-wrap items-center justify-between gap-3", open && "mb-3")}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200", !open && "-rotate-90")}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-admin-ink">Normal sales per night</span>
            <span className="block text-[12px] text-admin-muted">{subtitle(view)}</span>
          </span>
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full [&_button]:max-sm:flex-1">
            <button type="button" onClick={onSync} disabled={busy} className={cn(NEUTRAL_BUTTON, "whitespace-nowrap")}>
              <Download className={cn("h-3.5 w-3.5", syncing && "animate-pulse")} aria-hidden="true" />
              Sync sales from Square
            </button>
            <button
              type="button"
              onClick={onRecalculate}
              disabled={busy || weekdays.length === 0}
              className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", reading && "animate-spin")} aria-hidden="true" />
              Recalculate
            </button>
          </div>
        )}
      </div>

      {open && weekdays.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                <th className="py-2 pr-3 font-semibold">Drink</th>
                {weekdays.map((day) => (
                  <th key={day} className="py-2 pr-3 text-right font-semibold">
                    {WEEKDAY_NAMES[day].slice(0, 3)}
                  </th>
                ))}
                <th className="py-2 text-right font-semibold">Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line/60">
              {view.rows.map((row) => (
                <tr key={row.menuItemPriceId} className={cn(!row.linked && "text-admin-muted")}>
                  <td className="py-2 pr-3">
                    <span className="font-semibold text-admin-ink">{row.name}</span>{" "}
                    <span className="text-admin-muted">{row.serve}</span>
                    {!row.linked && <span className="ml-2 text-[11px] text-admin-warning">not linked to Square</span>}
                  </td>
                  {weekdays.map((day) => {
                    const cell = row.byWeekday.find((c) => c.weekday === day);
                    return (
                      <td key={day} className="py-2 pr-3 text-right tabular-nums">
                        {cell ? (
                          <>
                            <span className="font-semibold text-admin-ink">{cell.unitsAvg.toFixed(1)}</span>
                            <span className="ml-1 text-[11px] text-admin-muted">/{cell.nightsSampled}n</span>
                          </>
                        ) : (
                          <span className="text-admin-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 text-right">
                    <OverrideInput eventId={view.eventId} row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-admin-muted">
            Average units per night over the last six nights on that weekday, with how many nights were sampled. A night
            runs 6am to 6am. An override replaces the figure for that drink; leave it blank to use history.
          </p>
        </div>
      )}
    </section>
  );
}
