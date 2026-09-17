"use client";

import { Loader2, RotateCcw } from "lucide-react";
import type { TillRestoreSummary } from "./types";
import { OUTLINE_BUTTON, formatRunDate } from "./ui";

/* Only rendered while Square still holds market prices, so after a clean
   close it disappears on its own. Amber because it is a pending decision. */
export function TillRestoreBanner({
  tillRestore,
  onRestore,
  isPending,
}: {
  tillRestore: TillRestoreSummary;
  onRestore: () => void;
  isPending: boolean;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-warning/40 bg-admin-warning-bg px-4 py-3 sm:px-5">
      <p className="text-[13px] text-admin-ink">
        <span className="font-semibold">
          {tillRestore.count} drink{tillRestore.count === 1 ? "" : "s"} still at market price on the till
        </span>
        <span className="text-admin-muted">
          {tillRestore.status === "live"
            ? " · market is live"
            : ` · market ended ${formatRunDate(tillRestore.endedAt)}`}
        </span>
      </p>
      <button type="button" onClick={onRestore} disabled={isPending} className={OUTLINE_BUTTON}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        )}
        Restore till prices
      </button>
    </section>
  );
}
