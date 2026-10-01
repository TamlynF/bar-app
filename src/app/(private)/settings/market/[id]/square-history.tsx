"use client";

import { Fragment, useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "@/lib/market/normal-units";
import type { SalesHistory } from "@/lib/market/sales-history";
import { squareSalesHistoryAction } from "../actions";
import { NormalUnitsCell, type NormalUnitsRowView } from "./normal-units-card";
import { SheetRow } from "./sheet-section";

type HistoryState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; history: SalesHistory };

function plural(count: number, word: string): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? word : `${word}s`}`;
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? quantity.toLocaleString("en-GB") : quantity.toFixed(1);
}

function totals(nights: number, orders: number, quantity: number): string {
  return `${plural(nights, "night")} · ${plural(orders, "order")} · ${formatQuantity(quantity)} sold`;
}

function ExpandRow({
  label,
  value,
  open,
  onToggle,
  depth,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  depth: 0 | 1;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex min-h-10 w-full items-center gap-2 border-b border-admin-line/70 py-2 pr-4 text-left transition-colors hover:bg-admin-surface sm:pr-5",
        depth === 0 ? "pl-4 sm:pl-5" : "bg-admin-surface/50 pl-8 sm:pl-9",
      )}
    >
      <ChevronDown
        className={cn("h-3.5 w-3.5 shrink-0 text-admin-muted transition-transform duration-200", !open && "-rotate-90")}
        aria-hidden="true"
      />
      <span className="shrink-0 text-[12px] font-semibold text-admin-muted">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[13px] font-semibold text-admin-ink tabular-nums">{value}</span>
    </button>
  );
}

/* The Square sales behind a linked serve: its normal units a night, then
   every synced order line rolled up, opening by weekday and then by night. */
export default function SquareHistoryRows({
  variationId,
  normals,
  weekdays,
}: {
  variationId: string | null;
  normals: NormalUnitsRowView | undefined;
  weekdays: number[];
}) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [openDays, setOpenDays] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!variationId) return;
    let cancelled = false;
    squareSalesHistoryAction(variationId).then(
      (result) => {
        if (cancelled) return;
        setState("error" in result ? { status: "error", message: result.error } : { status: "ready", history: result.history });
      },
      () => {
        if (!cancelled) setState({ status: "error", message: "Could not read the Square sales." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [variationId]);

  const toggleDay = (weekday: number) =>
    setOpenDays((current) => {
      const next = new Set(current);
      if (next.has(weekday)) next.delete(weekday);
      else next.add(weekday);
      return next;
    });

  return (
    <>
      <SheetRow
        label="Normal / night"
        value={normals ? <NormalUnitsCell row={normals} weekdays={weekdays} className="items-end" /> : "-"}
      />
      {!variationId ? (
        <SheetRow label="Sales" value={<span className="font-medium text-admin-muted">Not linked to Square</span>} />
      ) : state.status === "loading" ? (
        <SheetRow
          label="Sales"
          value={
            <span className="inline-flex items-center gap-1.5 font-medium text-admin-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Reading Square sales
            </span>
          }
        />
      ) : state.status === "error" ? (
        <SheetRow label="Sales" value={state.message} tone="error" />
      ) : state.history.nights === 0 ? (
        <SheetRow label="Sales" value={<span className="font-medium text-admin-muted">No Square sales synced yet</span>} />
      ) : (
        <>
          <ExpandRow
            label="Sales"
            value={totals(state.history.nights, state.history.orders, state.history.quantity)}
            open={totalsOpen}
            onToggle={() => setTotalsOpen((open) => !open)}
            depth={0}
          />
          {totalsOpen &&
            state.history.byWeekday.map((day) => (
              <Fragment key={day.weekday}>
                <ExpandRow
                  label={WEEKDAY_NAMES[day.weekday]}
                  value={totals(day.nights, day.orders, day.quantity)}
                  open={openDays.has(day.weekday)}
                  onToggle={() => toggleDay(day.weekday)}
                  depth={1}
                />
                {openDays.has(day.weekday) && (
                  <div className="overflow-x-auto border-b border-admin-line/70 bg-admin-surface/30">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                          <th className="py-1.5 pr-3 pl-12 sm:pl-14">Night</th>
                          <th className="py-1.5 pr-3 text-right">Orders</th>
                          <th className="py-1.5 pr-3 text-right">Qty</th>
                          {state.history.hasModifiers && <th className="py-1.5 pr-4 sm:pr-5">Modifiers</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {day.byNight.map((night) => (
                          <tr key={night.night} className="border-t border-admin-line/50">
                            <td className="py-1.5 pr-3 pl-12 font-semibold whitespace-nowrap text-admin-ink sm:pl-14">
                              {format(new Date(night.night + "T00:00:00"), "d MMM yyyy")}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-admin-ink tabular-nums">{night.orders}</td>
                            <td className="py-1.5 pr-3 text-right font-semibold text-admin-ink tabular-nums">
                              {formatQuantity(night.quantity)}
                            </td>
                            {state.history.hasModifiers && (
                              <td className="py-1.5 pr-4 text-admin-muted sm:pr-5">
                                {night.modifiers.length
                                  ? night.modifiers.map((m) => `${m.name} ×${formatQuantity(m.quantity)}`).join(", ")
                                  : "-"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Fragment>
            ))}
        </>
      )}
    </>
  );
}
