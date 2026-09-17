"use client";

import { Check, CircleAlert, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventReadiness, ReadinessStep } from "@/lib/market/event-readiness";
import { formatShortStamp } from "./ui";

/* One mark per readiness step, shared by the sheet's summary and the event
   page's checklist so the same state reads the same in both places. */
export function StepMark({ step, className }: { step: ReadinessStep; className?: string }) {
  const base = "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full";
  if (step === "done") {
    return (
      <span className={cn(base, "bg-admin-success-bg text-admin-success", className)} aria-label="Done">
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  if (step === "optional") {
    return (
      <span className={cn(base, "bg-admin-surface text-admin-muted", className)} aria-label="Optional">
        <Minus className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-admin-warning-bg text-admin-warning", className)} aria-label="To do">
      <CircleAlert className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

export function drinksStepText(readiness: EventReadiness): string {
  if (readiness.drinks === 0) return "No drinks yet";
  if (readiness.tradeable === 0) return `${readiness.drinks} on the board, none with a price to trade`;
  return `${readiness.drinks} ${readiness.drinks === 1 ? "drink" : "drinks"} on the board`;
}

export function linksStepText(readiness: EventReadiness): string {
  if (readiness.drinks === 0) return "Pick drinks first";
  if (readiness.linked === readiness.drinks) return "All linked to Square";
  return `${readiness.linked} of ${readiness.drinks} linked to Square`;
}

export function normalsStepText(readiness: EventReadiness): string {
  if (readiness.normalsComputedAt) return `Read from Square ${formatShortStamp(readiness.normalsComputedAt)}`;
  if (readiness.steps.normals === "optional") return "Not read · optional for demand pricing";
  return "Not read from Square yet";
}
