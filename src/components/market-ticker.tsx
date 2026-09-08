"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MarketSheet } from "@/components/market-sheet";
import { RollingPrice } from "@/components/rolling-price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload, MarketStatePayload } from "@/lib/market/tick";

export function headlineDeal(instruments: MarketInstrumentPayload[] | undefined) {
  if (!instruments?.length) return null;
  const inStock = instruments.filter((i) => i.stock !== "out");
  const pool = inStock.length ? inStock : instruments;
  const dropped = pool.filter((i) => i.changePct < 0);
  if (dropped.length) return dropped.reduce((a, b) => (b.changePct < a.changePct ? b : a));
  return pool.reduce((a, b) => (b.price < a.price ? b : a));
}

/* Phone-only strip under the top bar while the drinks market trades: the
   phone echo of the big-screen ticker. Shows the best deal with its price
   rolling; a tap opens the market-at-a-glance sheet. Lives in the nav chrome
   rather than on the poster so it reads as the bar's status, not the act's.
   Hidden on the market pages, from `sm` up (the nav pill takes over) and on
   the installed app (the bottom bar's Market slot takes over). */
export function MarketTicker({
  state,
  className,
}: {
  state: MarketStatePayload;
  className?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (state.status !== "live") return null;

  const deal = headlineDeal(state.instruments);
  const price = deal ? (deal.tillPrice ?? deal.price) : null;
  const crash = Boolean(state.crashActive);
  const label = deal ? `Drinks market open: ${deal.name} now £${price?.toFixed(2)}` : "Drinks market open";

  return (
    <>
      <MarketSheet state={state} deal={deal} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <div className={cn("relative z-30 bg-canvas standalone:hidden sm:hidden", className)}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={`${label}. Show the market`}
          aria-haspopup="dialog"
          className={cn(
            "relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden border-y px-4 text-left active:brightness-110",
            crash
              ? "ad-market-cta-crash border-[#FF6B35]/40"
              : "border-[#FDCC4B]/25 bg-[#FDCC4B]/12 text-ink"
          )}
        >
          <span className="ad-shimmer pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <span className="relative inline-flex shrink-0 items-center gap-1.5 font-black text-[9px] tracking-[0.22em] uppercase">
            <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
            <span className={crash ? "text-white" : "text-gold"}>{crash ? "Crash on" : "Market open"}</span>
          </span>
          <span className="relative h-3 w-px shrink-0 bg-current opacity-25" aria-hidden="true" />
          <span className="relative flex min-w-0 flex-1 items-center gap-1.5 font-black text-[12px] tracking-tight uppercase">
            {deal ? (
              <>
                <span className="truncate">{deal.name}</span>
                <RollingPrice value={price} className={cn("shrink-0", crash ? "text-white" : "text-gold")} />
                {deal.changePct < 0 && (
                  <span className="shrink-0 text-[10px] text-neon tabular-nums">
                    ↓{Math.abs(Math.round(deal.changePct))}%
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">Buy the dips</span>
            )}
          </span>
          <ChevronRight className="relative h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
