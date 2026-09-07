"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RollingPrice } from "@/components/rolling-price";
import { Sparkline } from "@/components/sparkline";
import { headlineDeal } from "@/components/market-cta";
import { useMarketState } from "@/hooks/use-market-live";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";

/* Desktop-only card in the top-right of the poster hero while the drinks
   market trades: the best deal, its session line and the way in. Renders
   nothing when the market is closed (phones get MarketPill instead). */
export function MarketHeroCard({ className }: { className?: string }) {
  const state = useMarketState();
  if (state.status !== "live") return null;

  const deal = headlineDeal(state.instruments);
  const crash = state.crashActive;
  const price = deal ? (deal.tillPrice ?? deal.price) : null;
  const down = (deal?.changePct ?? 0) < 0;

  return (
    <div
      className={cn(
        "hidden w-85 overflow-hidden rounded-2xl border border-gold/45 bg-canvas/80 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:block",
        className
      )}
    >
      <div className={cn("h-1", crash ? "ad-market-cta-crash" : "ad-market-cta")} aria-hidden="true" />
      <div className="px-4.5 pt-4 pb-4.5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-black text-[10px] tracking-[0.24em] text-gold uppercase">
            <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
            {crash ? "Crash on" : "Drinks market open"}
          </span>
          <span className="text-[11px] text-ink-2">Prices move every {state.tickIntervalSec ?? 30}s</span>
        </div>

        {deal && (
          <>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-[9px] tracking-[0.2em] text-ink-2 uppercase">
                  {crash ? "Everything's down" : "Best deal right now"}
                </p>
                <p className="mt-1 truncate font-black text-[22px] leading-none tracking-tighter text-ink uppercase">
                  {deal.name}
                </p>
                <p className="mt-1 text-[11px] text-ink-2">usually {formatGbp(deal.basePrice)}</p>
              </div>
              <div className="shrink-0 text-right">
                <RollingPrice value={price} className="font-black text-[34px] leading-none text-gold" />
                <p className={cn("mt-0.5 font-black text-xs tabular-nums", down ? "text-[#6EE7B7]" : "text-[#FF6B6B]")}>
                  {down ? "↓" : "↑"}
                  {Math.abs(Math.round(deal.changePct))}%
                </p>
              </div>
            </div>
            <Sparkline
              points={deal.spark}
              width={304}
              height={34}
              stroke={down ? "#6EE7B7" : "#FF6B6B"}
              className="mt-3 h-8.5 w-full"
            />
          </>
        )}

        <Link
          href="/market"
          className={cn(
            "group mt-3 flex h-11 items-center justify-center gap-2 rounded-xl font-black text-xs tracking-[0.12em] text-on-gold uppercase shadow-[0_14px_32px_-12px_rgba(255,107,53,0.6)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]",
            crash ? "ad-market-cta-crash" : "ad-market-cta"
          )}
        >
          Open the market
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
