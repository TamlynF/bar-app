"use client";

import Link from "next/link";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NEUTRAL_BUTTON, formatStamp } from "../ui";

export type EventSession = {
  id: number;
  status: string;
  tickNo: number;
  startedAt: string;
  endedAt: string | null;
};

const SHOWN = 8;

/* Every night this event has run, newest first, each leading into that
   night's price and stock history. */
export function MarketNightsMenu({ sessions }: { sessions: EventSession[] }) {
  const recent = sessions.slice(0, SHOWN);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(NEUTRAL_BUTTON, "whitespace-nowrap")}>
          <History className="h-4 w-4" aria-hidden="true" />
          Market nights
          <span className="text-admin-muted tabular-nums">({sessions.length})</span>
          <ChevronDown className="h-3.5 w-3.5 text-admin-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-admin-muted">
          {sessions.length === 0 ? "This event has not been opened yet" : "Nights this event has run"}
        </DropdownMenuLabel>
        {recent.map((session) => (
          <DropdownMenuItem key={session.id} asChild className="min-h-11 cursor-pointer">
            <Link
              href={`/settings/market/history?session=${session.id}`}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-admin-ink">
                  {formatStamp(session.startedAt)}
                  {session.endedAt ? ` to ${formatStamp(session.endedAt).split(", ").pop()}` : ""}
                </span>
                <span className="block text-[11px] text-admin-muted">
                  {session.tickNo} price {session.tickNo === 1 ? "update" : "updates"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  session.status === "live"
                    ? "bg-admin-success-bg text-admin-success"
                    : "bg-admin-surface text-admin-muted"
                )}
              >
                {session.status === "live" ? "Live" : "Ended"}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        {sessions.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem asChild className="min-h-11 cursor-pointer">
          <Link href="/settings/market/history" className="flex w-full items-center gap-2 text-[13px] font-semibold text-admin-primary">
            <History className="h-4 w-4" aria-hidden="true" />
            All history
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
