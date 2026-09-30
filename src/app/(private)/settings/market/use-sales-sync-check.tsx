"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { SalesSyncHealth } from "@/lib/market/sales-sync-health";
import { salesSyncStatusAction, syncSquareSalesAction } from "./actions";
import { formatStamp } from "./ui";

type SyncChoice = "sync" | "skip";

const SYNC_CHOICES: { value: SyncChoice; label: string; hint: string }[] = [
  {
    value: "sync",
    label: "Sync sales now, then open",
    hint: "Pulls the latest Square sales so tonight's tiers rank against up-to-date nights. Takes a few seconds.",
  },
  {
    value: "skip",
    label: "Open without syncing",
    hint: "Normal sales stay as they were last worked out. Tiers may lean on older nights.",
  },
];

function SyncChoiceField({ onChange }: { onChange: (choice: SyncChoice) => void }) {
  const [choice, setChoice] = useState<SyncChoice>("sync");
  return (
    <fieldset className="space-y-2 pb-2">
      <legend className="mb-2 text-[13px] font-semibold text-admin-ink">Before the market opens</legend>
      {SYNC_CHOICES.map((option) => (
        <label
          key={option.value}
          htmlFor={`sales-sync-${option.value}`}
          className={cn(
            "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-admin-card px-3 py-2.5 transition-colors",
            choice === option.value ? "border-admin-primary bg-admin-primary-soft" : "border-admin-line hover:bg-admin-surface"
          )}
        >
          <input
            id={`sales-sync-${option.value}`}
            type="radio"
            name="sales-sync"
            value={option.value}
            checked={choice === option.value}
            onChange={() => {
              setChoice(option.value);
              onChange(option.value);
            }}
            className="mt-0.5 h-4 w-4 accent-admin-primary"
          />
          <span>
            <span className="block text-[13px] font-semibold text-admin-ink">{option.label}</span>
            <span className="block text-[11px] text-admin-muted">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function problemText(health: Extract<SalesSyncHealth, { healthy: false }>): string {
  if (health.reason === "never") {
    return "Square sales have never been synced, so no drink has a normal night to rank against.";
  }
  const last = health.lastSyncedAt ? formatStamp(health.lastSyncedAt) : "never";
  if (health.reason === "failed") {
    return `The last sales sync failed${health.lastRunAt ? ` (${formatStamp(health.lastRunAt)})` : ""}${
      health.lastError ? `: ${health.lastError}` : ""
    }. Sales are only synced up to ${last}.`;
  }
  return `The nightly sales sync has not run since ${last}, so recent nights are missing.`;
}

/* Runs before opening a market: when the nightly Square sales sync failed or
   missed a night, it asks whether to sync first. Resolves true when the
   market should go ahead and open, false when staff cancelled or the retry
   failed. A healthy sync opens straight through with no popup. */
export function useSalesSyncCheck() {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const choiceRef = useRef<SyncChoice>("sync");

  async function checkSalesSync(): Promise<boolean> {
    let health: SalesSyncHealth;
    try {
      health = await salesSyncStatusAction();
    } catch {
      return true;
    }
    if (health.healthy) return true;

    choiceRef.current = "sync";
    const confirmed = await confirm({
      title: "Sales history may be out of date",
      description: `${problemText(health)} Each drink's normal sales per night come from this history, and the tiers rank tonight's sales against them.`,
      content: <SyncChoiceField onChange={(choice) => (choiceRef.current = choice)} />,
      confirmLabel: "Open market",
    });
    if (!confirmed) return false;
    if ((choiceRef.current as SyncChoice) === "skip") return true;

    const toastId = toast.loading("Syncing sales from Square…");
    const result = await syncSquareSalesAction();
    if ("error" in result && result.error) {
      toast.error(`Sync failed again: ${result.error}. The market was not opened - try again, or open without syncing.`, {
        id: toastId,
      });
      return false;
    }
    toast.success(
      `Sales synced - ${"ordersSynced" in result ? result.ordersSynced : 0} orders. Opening the market…`,
      { id: toastId }
    );
    return true;
  }

  return { checkSalesSync, SalesSyncDialogUI: ConfirmDialogUI };
}
