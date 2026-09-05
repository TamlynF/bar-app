"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, TrendingDown, Zap } from "lucide-react";
import { MarketSheet } from "@/components/market-sheet";
import { RollingPrice } from "@/components/rolling-price";
import { useMarketState } from "@/hooks/use-market-live";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload } from "@/lib/market/tick";

function headlineDeal(instruments: MarketInstrumentPayload[] | undefined) {
  if (!instruments?.length) return null;
  const inStock = instruments.filter((i) => i.stock !== "out");
  const pool = inStock.length ? inStock : instruments;
  const dropped = pool.filter((i) => i.changePct < 0);
  if (dropped.length)
    return dropped.reduce((a, b) => (b.changePct < a.changePct ? b : a));
  return pool.reduce((a, b) => (b.price < a.price ? b : a));
}

/* Phone-only "live activity" button, bottom-left while the drinks market
   trades. Starts collapsed as a shimmering round icon; one tap expands it to
   show the best deal with the price ticking; a tap on the expanded pill goes
   to the market. Tapping elsewhere collapses it again. Hidden on the market
   page itself and from `sm` up (the hero button takes over there). */
export function MarketPill() {
  const state = useMarketState();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [expanded]);

  if (state.status !== "live" || pathname?.startsWith("/market")) return null;

  const deal = headlineDeal(state.instruments);
  const price = deal ? (deal.tillPrice ?? deal.price) : null;
  const crash = state.crashActive;
  const label = deal
    ? `Drinks market open: ${deal.name} now ${formatGbp(price)}`
    : "Drinks market open";

  const icon = crash ? (
    <Zap className="h-5 w-5" aria-hidden="true" />
  ) : (
    <TrendingDown className="h-5 w-5" aria-hidden="true" />
  );
  const iconClass = cn(
    "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-on-gold",
    crash
      ? "bg-linear-to-br from-neon to-[#E6392E] text-ink"
      : "bg-linear-to-br from-gold to-neon",
  );

  const sheet = (
    <MarketSheet
      state={state}
      deal={deal}
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
    />
  );

  if (!expanded) {
    return (
      <>
        {sheet}
        <div
          ref={rootRef}
          className="pointer-events-none fixed right-0 bottom-0 z-40 pr-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:hidden"
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`${label}. Show details`}
            aria-expanded={false}
            className={cn(
              iconClass,
              "pointer-events-auto h-14 w-14 shadow-[0_14px_30px_-8px_rgba(255,107,53,0.7)] ring-2 ring-canvas active:scale-95 [&_svg]:h-6 [&_svg]:w-6",
            )}
          >
            <span
              className="ad-shimmer pointer-events-none absolute inset-0 opacity-80"
              aria-hidden="true"
            />
            {icon}
            <span
              className="ad-live-dot absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[#E6392E] ring-2 ring-canvas"
              aria-hidden="true"
            />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {sheet}
      <div
        ref={rootRef}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:hidden"
      >
        <div
          className={cn(
            "ad-market-pill ad-pill-expand pointer-events-auto relative flex max-w-full items-center overflow-hidden rounded-full p-1 text-ink shadow-[0_18px_40px_-10px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur-xl",
            crash && "ad-market-pill-crash",
          )}
        >
          <span
            className="ad-shimmer pointer-events-none absolute inset-0 opacity-60"
            aria-hidden="true"
          />

          {/* Body: the deal - tap for the market at a glance */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`${label}. Show the market`}
            aria-haspopup="dialog"
            className="group relative flex min-w-0 items-center gap-2 py-1.5 pr-2 pl-3.5 text-left active:scale-[0.98]"
          >
            <span className="relative flex min-w-0 flex-col leading-none">
              <span className="inline-flex items-center gap-1.5 font-black text-[8px] tracking-[0.22em] text-gold uppercase">
                <span
                  className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]"
                  aria-hidden="true"
                />
                {crash ? "Crash on" : "Market open"}
              </span>
              <span className="mt-1 flex items-baseline gap-1.5 font-black text-[13px] tracking-tight uppercase">
                {deal ? (
                  <>
                    <span className="max-w-[9rem] truncate">{deal.name}</span>
                    <RollingPrice value={price} className="text-gold" />
                    {deal.changePct < 0 && (
                      <span className="text-[10px] text-neon tabular-nums">
                        ↓{Math.abs(Math.round(deal.changePct))}%
                      </span>
                    )}
                  </>
                ) : (
                  "Buy the dips"
                )}
              </span>
            </span>
            <ArrowRight
              className="relative h-4 w-4 shrink-0 text-gold transition-transform group-active:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          {/* Icon stays in the corner - tap to collapse */}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Hide market details"
            aria-expanded={true}
            className={cn(iconClass, "active:scale-95")}
          >
            {icon}
          </button>
        </div>
      </div>
    </>
  );
}
