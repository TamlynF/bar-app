"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Link2, Loader2, Play, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventReadiness } from "@/lib/market/event-readiness";
import { StepMark, drinksStepText, linksStepText, normalsStepText } from "../readiness-ui";
import { OUTLINE_BUTTON, PRIMARY_BUTTON } from "../ui";

/* The steps between an event and its first tick, in the order they are
   done, each with the one control that does it, ending with Open market.
   Once every step is done the list folds to a single line and the Open
   button is all that is left. Closing happens on the Market page only. */
export function ReadyToOpenChecklist({
  readiness,
  eventId,
  anyLive,
  isPending,
  readingNormals,
  syncingSales,
  salesSyncedAt,
  canReadNormals,
  onOpen,
  onAddDrinks,
  onReadNormals,
  onSyncSales,
}: {
  readiness: EventReadiness;
  eventId: number;
  anyLive: boolean;
  isPending: boolean;
  readingNormals: boolean;
  syncingSales: boolean;
  salesSyncedAt: string | null;
  canReadNormals: boolean;
  onOpen: () => void;
  onAddDrinks: () => void;
  onReadNormals: () => void;
  onSyncSales: () => void;
}) {
  const [expanded, setExpanded] = useState(!readiness.ready);
  const open = readiness.ready ? expanded : true;
  const openTitle = anyLive
    ? "Close the live market first"
    : !readiness.canOpen
      ? "Pick at least one priced drink first"
      : undefined;
  const openButton = (
    <button
      type="button"
      onClick={onOpen}
      disabled={isPending || anyLive || !readiness.canOpen}
      title={openTitle}
      className={cn(PRIMARY_BUTTON, "whitespace-nowrap bg-admin-success hover:bg-admin-success/90")}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
      )}
      Open market
    </button>
  );

  const steps = [
    {
      key: "drinks",
      number: 1,
      label: "Pick the drinks",
      step: readiness.steps.drinks,
      text: drinksStepText(readiness),
      action: (
        <button type="button" onClick={onAddDrinks} className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add from menu
        </button>
      ),
    },
    {
      key: "links",
      number: 2,
      label: "Link them to Square",
      step: readiness.steps.links,
      text: linksStepText(readiness),
      action: (
        <Link href={`/settings/market/square-links?event=${eventId}`} className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Square links
        </Link>
      ),
    },
    {
      key: "normals",
      number: 3,
      label: "Work out normal sales",
      step: readiness.steps.normals,
      text: canReadNormals ? normalsStepText(readiness, salesSyncedAt) : "Set which days this event runs on first",
      action:
        salesSyncedAt === null ? (
          <button
            type="button"
            onClick={onSyncSales}
            disabled={syncingSales || readingNormals}
            className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}
          >
            <Download className={cn("h-4 w-4", syncingSales && "animate-pulse")} aria-hidden="true" />
            Sync sales from Square
          </button>
        ) : (
          <button
            type="button"
            onClick={onReadNormals}
            disabled={readingNormals || syncingSales || !canReadNormals}
            className={cn(OUTLINE_BUTTON, "whitespace-nowrap")}
          >
            <RefreshCw className={cn("h-4 w-4", readingNormals && "animate-spin")} aria-hidden="true" />
            {readiness.normalsComputedAt ? "Recalculate" : "Work out now"}
          </button>
        ),
    },
    {
      key: "open",
      number: 4,
      label: "Open the market",
      step: readiness.canOpen ? ("optional" as const) : ("todo" as const),
      text: anyLive
        ? "Another market is live - close it on the Market page first"
        : readiness.canOpen
          ? "Trading starts straight away; the trading floor is on the Market page"
          : "Pick at least one priced drink first",
      action: openButton,
    },
  ];

  return (
    <div className="mt-4 rounded-xl border border-admin-line bg-admin-surface/60">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => readiness.ready && setExpanded((value) => !value)}
          aria-expanded={open}
          disabled={!readiness.ready}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
        >
          {readiness.ready ? (
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200", !open && "-rotate-90")}
              aria-hidden="true"
            />
          ) : (
            <StepMark step="todo" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-bold text-admin-ink">
              {readiness.ready ? "Ready to open" : "Before you open"}
            </span>
            <span className="block truncate text-[11px] text-admin-muted">
              {readiness.ready
                ? `${readiness.drinks} drinks · ${readiness.linked} linked · ${readiness.normalsComputedAt ? "sales read" : "sales optional"}`
                : "Work down the list, then open the market"}
            </span>
          </span>
        </button>
        {readiness.ready && !open && <span className="max-sm:w-full [&_button]:max-sm:w-full">{openButton}</span>}
      </div>

      {open && (
        <ol className="m-0 list-none divide-y divide-admin-line/60 border-t border-admin-line p-0">
          {steps.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
              <StepMark step={row.step} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-admin-ink">
                  <span className="text-admin-muted tabular-nums">{row.number}. </span>
                  {row.label}
                </span>
                <span className="block text-[11px] text-admin-muted">{row.text}</span>
              </span>
              <span className="max-sm:w-full [&_a]:max-sm:w-full [&_button]:max-sm:w-full">{row.action}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
