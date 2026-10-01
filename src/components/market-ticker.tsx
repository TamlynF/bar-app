"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MarketSheet } from "@/components/market-sheet";
import { RollingPrice } from "@/components/rolling-price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload, MarketStatePayload } from "@/lib/market/tick";
import { displayPrice } from "@/app/(public)/market/market-ui";

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
   Hidden on the market pages and from `sm` up (the nav pill takes over). */
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
  const price = deal ? (displayPrice(deal) ?? deal.price) : null;
  const crash = Boolean(state.crashActive);
  const status = crash ? "Crash on" : deal ? "Live deal" : "Open now";
  const label = deal ? `Drinks exchange ${status.toLowerCase()}: ${deal.name} now £${price?.toFixed(2)}` : "Drinks exchange open";

  return (
    <>
      <MarketSheet state={state} deal={deal} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <div className={cn("relative z-30 bg-canvas sm:hidden", className)}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={`${label}. Show the exchange`}
          aria-haspopup="dialog"
          className={cn(
            "relative flex min-h-11 w-full items-center gap-2 overflow-hidden border-y px-4 text-left active:brightness-110",
            crash
              ? "ad-market-cta-crash border-[#FF6B35]/40"
              : "border-[#FDCC4B]/25 bg-[#FDCC4B]/12 text-ink"
          )}
        >
          <span className="ad-shimmer pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <span className="ad-live-dot relative h-1.5 w-1.5 shrink-0 rounded-full bg-[#E6392E]" aria-hidden="true" />
          <span className="relative flex shrink-0 flex-col gap-0.5 py-1.5 leading-none">
            <span className={cn("text-pill font-bold tracking-wide uppercase", crash ? "text-white" : "text-gold")}>Drinks Exchange</span>
            <span className={cn("text-pill font-semibold", crash ? "text-white/80" : "text-ink-2")}>{status}</span>
          </span>
          <span className="relative h-6 w-px shrink-0 bg-current opacity-25" aria-hidden="true" />
          <span className="relative flex min-w-0 flex-1 items-center gap-2 font-black text-meta tracking-tight uppercase">
            {deal ? (
              <>
                <span className="min-w-0 flex-1 leading-tight">{deal.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <RollingPrice value={price} className={crash ? "text-white" : "text-gold"} />
                  {deal.changePct < 0 && (
                    <span className="text-pill text-neon tabular-nums">↓{Math.abs(Math.round(deal.changePct))}%</span>
                  )}
                </span>
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
