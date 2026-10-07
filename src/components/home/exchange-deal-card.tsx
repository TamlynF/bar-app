"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { headlineDeal } from "@/components/market-ticker";
import { useMarketState } from "@/hooks/use-market-live";
import { displayPrice } from "@/app/(public)/market/market-ui";
import { cn } from "@/lib/utils";

/* The live drinks-exchange deal as the first card in "Deals on now" while
   the market trades: the best drop on the board, its price and how far it
   sits from the drink's normal price. A tap opens the board. */
export function ExchangeDealCard({ className }: { className?: string }) {
  const state = useMarketState();
  if (state.status !== "live") return null;

  const deal = headlineDeal(state.instruments);
  const price = deal ? (displayPrice(deal) ?? deal.price) : null;
  const pct =
    deal && price != null && deal.basePrice > 0
      ? Math.round(((price - deal.basePrice) / deal.basePrice) * 100)
      : null;
  const below = pct != null && pct < 0;
  const label = deal
    ? `Drinks exchange deal: ${deal.name} now £${price?.toFixed(2)}. Open the exchange`
    : "Drinks exchange is open. Open the exchange";

  return (
    <Link
      href="/market"
      aria-label={label}
      className={cn(
        "relative flex min-h-16 items-center gap-2.5 overflow-hidden rounded-2xl border border-gold/40 bg-linear-to-r from-gold/16 to-gold/8 px-3.5 py-2.5 text-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        className
      )}
    >
      <span className="ad-shim pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <span className="ad-live relative mx-1 size-2 shrink-0 rounded-full bg-[#3DDC84]" aria-hidden="true" />
      <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-pill font-bold tracking-wide text-gold uppercase">Drinks exchange deal</span>
        <span className="truncate text-base leading-tight font-bold text-ink">
          {deal ? deal.name : "Open now - buy the dips"}
        </span>
      </span>
      {deal && price != null && (
        <span className="relative flex shrink-0 items-center gap-1.5 tabular-nums">
          {pct != null && pct !== 0 && (
            <span className={cn("text-pill font-bold", below ? "text-[#3DDC84]" : "text-[#FF6B5E]")}>
              {below ? "↓" : "↑"}
              {Math.abs(pct)}%
            </span>
          )}
          <span className="text-lg leading-none font-bold text-ink">£{price.toFixed(2)}</span>
        </span>
      )}
      <ChevronRight className="relative size-4 shrink-0 text-gold/80" aria-hidden="true" />
    </Link>
  );
}
