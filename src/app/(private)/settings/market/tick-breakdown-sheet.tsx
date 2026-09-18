"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatGbp } from "@/lib/price";
import type { MarketConfig } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { instrumentTickBreakdownAction, type TickBreakdownRow } from "./actions";
import { ConfigHelp } from "./config-fields";
import type { InstrumentSummary } from "./types";

const SHEET_CLASS =
  "flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 border-0 bg-admin-bg p-0 shadow-2xl outline-none " +
  "sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:w-[900px] " +
  "sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-[20px] sm:border sm:border-admin-line";

type Column = {
  key: string;
  label: string;
  hint: string;
  help: string;
  render: (row: TickBreakdownRow) => string;
  value: (row: TickBreakdownRow) => number | null;
};

type Sort = { key: string; dir: "asc" | "desc" };

function sortRows(rows: TickBreakdownRow[], cols: Column[], sort: Sort): TickBreakdownRow[] {
  const col = cols.find((c) => c.key === sort.key);
  if (!col) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = col.value(a);
    const bv = col.value(b);
    if (av == null && bv == null) return a.tickNo - b.tickNo;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * sign || a.tickNo - b.tickNo;
  });
}

const dash = "—";
const num = (value: number | null, digits: number) => (value == null ? dash : value.toFixed(digits));
const gbp = (value: number | null) => (value == null ? dash : formatGbp(value));

const pctList = (values: number[]) => values.map((value) => `${Math.round(Math.abs(value) * 100)}%`).join(" / ");
const bandList = (bands: number[]) =>
  bands.map((upper, index) => `${index === 0 ? 1 : bands[index - 1] + 1}–${upper}`).join(" / ");

/* The dials from the top of workbook tab 10, with this event's values, so
   the rows below can be checked against the spreadsheet. */
function dials(config: MarketConfig): { label: string; value: string }[] {
  return [
    { label: "Re-rank every N ticks", value: String(config.rerankEveryTicks) },
    { label: "Glide per tick", value: `${Math.round(config.glidePct * 100)}%` },
    { label: "Warm-up: units sold before tiers apply", value: String(config.warmupUnits) },
    {
      label: `Mark-up tiers (most sold ${bandList(config.tierPcts.bands)})`,
      value: pctList(config.tierPcts.up),
    },
    {
      label: `Discount tiers (least sold ${bandList(config.tierPcts.bands)})`,
      value: pctList(config.tierPcts.down),
    },
    { label: "Pace: minimum 'normal' units per night", value: String(config.paceFloorUnits) },
    { label: "Ticks in a night (pace divides normal by this)", value: String(config.sessionTicksHint) },
    { label: "Till write threshold (£)", value: "none · the till follows every board move" },
  ];
}

function columns(config: MarketConfig, normalPerNight: number | null, openingPrice: number | null): Column[] {
  const floored = Math.max(normalPerNight ?? 0, config.paceFloorUnits);
  const perTick = floored / config.sessionTicksHint;
  return [
    {
      key: "tickNo",
      label: "Tick",
      hint: `One tick is ${config.tickIntervalSec} seconds`,
      help: "Tick 0 is the opening price. Every row after it is one run of the engine.",
      render: (row) => String(row.tickNo),
      value: (row) => row.tickNo,
    },
    {
      key: "opening",
      label: "Opening",
      hint: "The price this drink started the night at",
      help: "Fixed for the session. The board's change percentage and the Since open figure are measured from here, not from the base price.",
      render: () => gbp(openingPrice),
      value: () => openingPrice,
    },
    {
      key: "units",
      label: "Units",
      hint: "Sold since the last tick",
      help: "Completed till sales of this serve, plus any simulated sales queued for the tick. The only figure from the real world.",
      render: (row) => num(row.units, 0),
      value: (row) => row.units,
    },
    {
      key: "demandUnits",
      label: "Heat",
      hint: `last heat × ${config.decayK} + units`,
      help: "Recent sales that fade. Each tick keeps part of the previous heat and adds this tick's units, so a rush a few minutes ago still counts and one two hours ago does not.",
      render: (row) => num(row.demandUnits, 3),
      value: (row) => row.demandUnits,
    },
    {
      key: "pace",
      label: "Pace",
      hint: `heat ÷ ${perTick.toFixed(3)} (normal ${floored} a night ÷ ${config.sessionTicksHint} ticks)`,
      help: "Heat compared with what this drink sells per tick on a normal night. 1.00× is an ordinary night for it, 2.00× twice as busy. This is the only number the rank sorts on.",
      render: (row) => (row.pace == null ? dash : `${row.pace.toFixed(3)}×`),
      value: (row) => row.pace,
    },
    {
      key: "minsSinceSale",
      label: "Mins since sale",
      hint: "Ticks since this drink last sold, capped at 99",
      help: "Only a tie-break: when two drinks have the same pace, the one that sold more recently ranks higher.",
      render: (row) => (row.minsSinceSale == null ? dash : String(row.minsSinceSale)),
      value: (row) => row.minsSinceSale,
    },
    {
      key: "rankValue",
      label: "Rank value",
      hint: "pace + 0.0001 ÷ (1 + mins) + 0.0000001 × base",
      help: "Pace with two nudges too small to overturn a real difference: recency first, then a dearer base price. The table is sorted on this, highest first.",
      render: (row) => num(row.rankValue, 4),
      value: (row) => row.rankValue,
    },
    {
      key: "rankPos",
      label: "Rank",
      hint: `Position from the top; re-ranked every ${config.rerankEveryTicks} ticks`,
      help: "1 is the busiest drink relative to its own normal. Between re-ranks the rank shown is the last one awarded.",
      render: (row) => (row.rankPos == null ? dash : String(row.rankPos)),
      value: (row) => row.rankPos,
    },
    {
      key: "tierPct",
      label: "Adjust",
      hint: "The tier the rank earned, as a share of base price",
      help: `Top bands mark up, bottom bands discount, the middle stays at base. 0 until ${config.warmupUnits} drinks have sold in total.`,
      render: (row) => (row.tierPct == null ? dash : `${row.tierPct > 0 ? "+" : ""}${Math.round(row.tierPct * 100)}%`),
      value: (row) => row.tierPct,
    },
    {
      key: "targetPrice",
      label: "Target",
      hint: "base × (1 + adjust); the crash price during a crash",
      help: "Where the price is heading. It only changes when the tier changes or a crash starts or ends.",
      render: (row) => gbp(row.targetPrice),
      value: (row) => row.targetPrice,
    },
    {
      key: "price",
      label: "Price",
      hint: `last price + ${Math.round(config.glidePct * 100)}% of the gap to Target, held within the limits, rounded to ${Math.round(config.roundStep * 100)}p`,
      help: "The board price. It glides toward Target rather than jumping, and freezes while the drink is sold out.",
      render: (row) => gbp(row.price),
      value: (row) => row.price,
    },
    {
      key: "tillPrice",
      label: "Till price",
      hint: "What Square was charging after this tick",
      help: "The price written to the till. It lags the board by a tick and stays put when the drink isn't linked to Square.",
      render: (row) => gbp(row.tillPrice),
      value: (row) => row.tillPrice,
    },
  ];
}

/* Workbook tab 10 for one drink: every tick this session with the working
   the engine used, so a price on the board can be traced back to its sales. */
export function TickBreakdownSheet({
  instrument,
  config,
  onClose,
}: {
  instrument: InstrumentSummary | null;
  config: MarketConfig;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TickBreakdownRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRef = useRef<HTMLTableRowElement>(null);
  const [sort, setSort] = useState<Sort>({ key: "tickNo", dir: "asc" });
  const instrumentId = instrument?.id ?? null;

  useEffect(() => {
    if (instrumentId == null) return;
    let cancelled = false;
    instrumentTickBreakdownAction(instrumentId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setRows(result.rows);
    });
    return () => {
      cancelled = true;
      setRows(null);
      setError(null);
      setSort({ key: "tickNo", dir: "asc" });
    };
  }, [instrumentId]);

  useEffect(() => {
    if (rows?.length) latestRef.current?.scrollIntoView({ block: "end" });
  }, [rows]);

  const cols = columns(config, instrument?.normalUnitsPerNight ?? null, instrument?.openingPrice ?? null);
  const sorted = rows ? sortRows(rows, cols, sort) : null;
  const latestTick = rows && rows.length ? rows[rows.length - 1].tickNo : null;
  const toggleSort = (key: string) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <Sheet open={instrument != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
        <div className="mx-auto mt-2 h-1 w-11 shrink-0 rounded-full bg-admin-line" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-admin-line bg-admin-card px-4 pt-3 pb-3.5">
          <div className="min-w-0">
            <SheetDescription className="text-[12px] font-bold text-admin-muted">Tick breakdown · this session</SheetDescription>
            <SheetTitle className="mt-1 text-[18px] font-bold text-admin-ink">
              {instrument?.name}
              {instrument && <span className="font-medium text-admin-muted"> · {instrument.serve}</span>}
            </SheetTitle>
            {instrument && (
              <p className="mt-1 text-[12px] text-admin-muted">
                Base {formatGbp(instrument.basePrice)} · normal{" "}
                {instrument.normalUnitsPerNight == null ? dash : instrument.normalUnitsPerNight.toFixed(1)} a night
                {instrument.normalUnitsPerNight != null && instrument.normalUnitsPerNight < config.paceFloorUnits
                  ? `, floored to ${config.paceFloorUnits}`
                  : ""}
                . Hover a heading for how the column is worked out.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <dl className="grid shrink-0 grid-cols-1 gap-x-6 gap-y-1 border-b border-admin-line bg-admin-surface px-4 py-2.5 text-[11px] sm:grid-cols-2">
          {dials(config).map((dial) => (
            <div key={dial.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-admin-muted">{dial.label}</dt>
              <dd className="shrink-0 font-semibold text-admin-ink tabular-nums">{dial.value}</dd>
            </div>
          ))}
        </dl>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-3">
          {error ? (
            <p className="py-8 text-center text-[13px] text-admin-error">{error}</p>
          ) : rows == null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-admin-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="text-[13px]">Loading ticks…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-admin-muted">No ticks recorded for this drink yet.</p>
          ) : (
            <TooltipProvider>
              <table className="w-full min-w-[52rem] text-left text-[12px]">
                <thead className="sticky top-0 bg-admin-bg text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                  <tr className="border-b border-admin-line">
                    {cols.map((col) => {
                      const active = sort.key === col.key ? sort.dir : null;
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
                          className={cn("py-2 pr-2 font-semibold", col.key !== "tickNo" && "text-right")}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              aria-label={`Sort by ${col.label}${active ? `, currently ${active === "asc" ? "ascending" : "descending"}` : ""}`}
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded text-right whitespace-nowrap transition-colors hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none",
                                active && "text-admin-ink"
                              )}
                            >
                              {col.label}
                              {active === "asc" ? (
                                <ArrowUp className="h-3 w-3" aria-hidden="true" />
                              ) : active === "desc" ? (
                                <ArrowDown className="h-3 w-3" aria-hidden="true" />
                              ) : null}
                            </button>
                            <ConfigHelp field={col} />
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-line/60">
                  {(sorted ?? rows).map((row) => (
                    <tr
                      key={row.tickNo}
                      ref={row.tickNo === latestTick ? latestRef : undefined}
                      className={cn(row.reranked && "bg-admin-primary-soft/40")}
                    >
                      {cols.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "py-1.5 pr-2 tabular-nums",
                            col.key === "tickNo" ? "font-semibold text-admin-ink" : "text-right",
                            col.key === "price" ? "font-semibold text-admin-ink" : "text-admin-muted",
                            col.key === "units" && (row.units ?? 0) > 0 && "font-semibold text-admin-ink"
                          )}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-admin-muted">
                Shaded rows are re-rank ticks, when Rank and Adjust can change. Dashes are ticks recorded before the
                breakdown was kept, or figures the demand engine doesn&apos;t produce.
              </p>
            </TooltipProvider>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
