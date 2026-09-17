"use client";

import Link from "next/link";
import { Check, ChevronRight, Link2 } from "lucide-react";
import { StatusPill } from "@/components/admin";
import type { SquareLinksSummary } from "./types";

/* One line on the hub: how much of what will trade is linked to the till,
   and the way to the page that fixes it. The mapping itself lives there. */
export function SquareLinksSummaryCard({ summary }: { summary: SquareLinksSummary }) {
  const complete = summary.onBoard > 0 && summary.linked >= summary.onBoard;
  return (
    <Link
      href="/settings/market/square-links"
      className="flex items-center gap-3 rounded-2xl border border-admin-line bg-admin-card px-4 py-3 transition-colors hover:border-admin-primary/30 hover:bg-admin-surface/60 sm:px-5"
    >
      <Link2 className="h-5 w-5 shrink-0 text-admin-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-admin-ink">Square links</span>
        <span className="block text-[11px] text-admin-muted">
          Till sales drive demand for linked serves; inventory drives sold-out alerts
        </span>
      </span>
      <StatusPill
        tone={complete ? "success" : "warning"}
        icon={complete ? <Check className="h-3 w-3" /> : undefined}
        showLabelOnMobile
      >
        {summary.linked}/{summary.onBoard} linked
      </StatusPill>
      <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted opacity-40" aria-hidden="true" />
    </Link>
  );
}
