"use client";

import Link from "next/link";
import { ArrowRight, TrendingDown, Zap } from "lucide-react";
import { Fireworks } from "@/components/fireworks";
import { useMarketState } from "@/hooks/use-market-live";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload } from "@/lib/market/tick";

/* The best deal on the board right now: the drink furthest below its base
   price. Falls back to the cheapest drink when nothing has dropped yet. */
function headlineDeal(instruments: MarketInstrumentPayload[] | undefined) {
  if (!instruments?.length) return null;
  const inStock = instruments.filter((i) => i.stock !== "out");
  const pool = inStock.length ? inStock : instruments;
  const dropped = pool.filter((i) => i.changePct < 0);
  if (dropped.length) return dropped.reduce((a, b) => (b.changePct < a.changePct ? b : a));
  return pool.reduce((a, b) => (b.price < a.price ? b : a));
}

function shownPrice(i: MarketInstrumentPayload) {
  return i.tillPrice ?? i.price;
}

/* Live market button, shown in the hero only while the drinks market is
   trading. Renders nothing when closed (the parent row hides itself). */
export function MarketCta({ fallback = null }: { fallback?: React.ReactNode }) {
  const state = useMarketState();
  const live = state.status === "live";
  const deal = live ? headlineDeal(state.instruments) : null;

  if (!live) return <>{fallback}</>;

  const crash = state.crashActive;
  const crashMins = state.crashRemainingSec ? Math.max(1, Math.ceil(state.crashRemainingSec / 60)) : null;

  return (
    <Link
      href="/market"
      aria-label={
        deal
          ? `Drinks market is open: ${deal.name} now ${formatGbp(shownPrice(deal))}`
          : "Drinks market is open"
      }
      className={cn(
        "ad-market-cta group relative inline-flex w-full min-h-12 items-center gap-2.5 overflow-hidden rounded-xl pr-3 pl-2.5 sm:w-auto text-on-gold shadow-[0_14px_32px_-12px_rgba(255,107,53,0.6)] transition-transform hover:-translate-y-0.5 active:scale-[0.98] sm:min-h-16 sm:gap-4 sm:rounded-2xl sm:pr-5 sm:pl-4",
        crash && "ad-market-cta-crash"
      )}
    >
      <span className="ad-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />

      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas/85 text-gold sm:h-10 sm:w-10">
        <Fireworks distance={22} />
        {crash ? (
          <Zap className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        )}
      </span>

      <span className="relative flex min-w-0 flex-col items-start leading-none">
        <span className="mb-0.5 inline-flex items-center gap-1.5 font-black text-[8px] tracking-[0.2em] uppercase opacity-80 sm:mb-1 sm:text-[10px] sm:tracking-[0.24em]">
          <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
          {crash ? `Crash on${crashMins ? ` · ${crashMins} min left` : ""}` : "Drinks market open"}
        </span>
        <span className="flex items-baseline gap-1.5 font-black text-[13px] tracking-tight uppercase sm:gap-2 sm:text-base">
          {deal ? (
            <>
              <span className="max-w-[9rem] truncate sm:max-w-[13rem]">{deal.name}</span>
              <span key={shownPrice(deal)} className="ad-odometer inline-block tabular-nums">
                {formatGbp(shownPrice(deal))}
              </span>
              {deal.changePct < 0 && (
                <span className="text-[11px] tabular-nums opacity-80">
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
        className="relative ml-auto h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

/* Solid gold primary shown while the market is closed. */
export function BookTableLink() {
  return (
    <Link
      href="/book"
      className="group inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 sm:w-auto font-black text-[11px] tracking-[0.14em] text-on-gold uppercase transition-colors hover:bg-gold/90 active:scale-[0.98] sm:min-h-12"
    >
      Book a table
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
