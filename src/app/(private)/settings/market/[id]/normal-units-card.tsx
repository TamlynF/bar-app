"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import { recalculateNormalUnitsAction, saveEventNormalUnitsAction } from "../actions";

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
  rows: NormalUnitsRowView[];
};

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

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

export default function NormalUnitsCard({ view }: { view: NormalUnitsView }) {
  const [isPending, startTransition] = useTransition();
  const weekdays = view.weekdays;

  function recalculate() {
    startTransition(async () => {
      const result = await recalculateNormalUnitsAction(view.eventId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const unmapped = result.unmappedServes > 0 ? ` ${result.unmappedServes} serve(s) are not linked to Square and were skipped.` : "";
      toast.success(`Read ${result.nights} night(s) from Square for ${result.serves} serve(s).${unmapped}`);
    });
  }

  return (
    <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-admin-ink">Normal sales per night</h3>
          <p className="text-[12px] text-admin-muted">
            {weekdays.length === 0
              ? "Pick which day(s) this event runs on to read sales history from Square."
              : view.computedAt
                ? `From Square orders over the event's hours · last read ${formatStamp(view.computedAt)}`
                : "Not read from Square yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={recalculate}
          disabled={isPending || weekdays.length === 0}
          className="flex h-11 items-center gap-1.5 rounded-lg border border-[#34451F] px-4 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:opacity-50 sm:h-9"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} aria-hidden="true" />
          Read from Square
        </button>
      </div>

      {weekdays.length > 0 && (
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
            Average units per night, with how many nights were sampled. An override replaces the Square figure for that drink; leave it blank to use history.
          </p>
        </div>
      )}
    </section>
  );
}
