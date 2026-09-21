"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { RollingPrice } from "@/components/rolling-price";
import { useMarketState } from "@/hooks/use-market-live";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { displayPrice } from "@/app/(public)/market/market-ui";

const TRENDING = 5;
const REPEATS = 2;

function shown(i: MarketInstrumentPayload) {
  return displayPrice(i) ?? i.price;
}

function changeLabel(i: MarketInstrumentPayload) {
  if (i.changePct === 0) return null;
  return `${i.changePct < 0 ? "▼" : "▲"}${Math.abs(Math.round(i.changePct))}%`;
}

export function trendingDeals(instruments: MarketInstrumentPayload[] | undefined, n = TRENDING) {
  if (!instruments?.length) return [];
  const inStock = instruments.filter((i) => i.stock !== "out");
  const pool = inStock.length ? inStock : instruments;
  const dropped = pool.filter((i) => i.changePct < 0).sort((a, b) => a.changePct - b.changePct);
  if (dropped.length >= n) return dropped.slice(0, n);
  const rest = pool.filter((i) => i.changePct >= 0).sort((a, b) => shown(a) - shown(b));
  return [...dropped, ...rest].slice(0, n);
}

/* Phone-only LED ticker under the home poster while the drinks market
   trades: the five best deals roll past on one line (paused under a finger),
   and "Expand" opens a compact panel listing them with rolling prices and
   the way into the market. */
export function HomeMarketTicker() {
  const state = useMarketState();
  const [expanded, setExpanded] = useState(false);
  if (state.status !== "live") return null;

  const deals = trendingDeals(state.instruments);
  if (deals.length === 0) return null;
  const crash = Boolean(state.crashActive);
  const summary = deals
    .map((d) => `${d.name} ${formatGbp(shown(d))}${d.changePct < 0 ? ` down ${Math.abs(Math.round(d.changePct))}%` : ""}`)
    .join(", ");

  return (
    <section
      aria-label="Drinks market"
      className={cn("ad-led mx-4 mt-3 overflow-hidden rounded-[14px] standalone:hidden sm:hidden", crash && "ad-led-crash")}
    >
      <p className="sr-only">
        {crash ? "Market crash." : "Drinks market open."} {summary}
      </p>
      <div className="flex h-11 items-stretch">
        <span className="ad-led-text flex shrink-0 flex-col items-center justify-center gap-1 border-r border-gold/20 px-2 text-pill font-bold tracking-wide uppercase">
          <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
          {crash ? "Crash" : "Live"}
        </span>
        <div
          aria-hidden="true"
          className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
        >
          <div className="ad-marquee-track h-full items-center" style={{ "--marquee-duration": `${deals.length * 6}s` } as React.CSSProperties}>
            {Array.from({ length: 2 }, (_, half) => (
              <div key={half} className="flex">
                {Array.from({ length: REPEATS }, (_, r) =>
                  deals.map((d) => (
                    <span
                      key={`${r}-${d.id}`}
                      className="ad-led-text inline-flex items-center gap-2 pr-3 font-black text-[13px] leading-none tracking-tight whitespace-nowrap uppercase tabular-nums"
                    >
                      <span>{d.name}</span>
                      <span>{formatGbp(shown(d))}</span>
                      {changeLabel(d) && (
                        <span className={cn("text-[11px]", d.changePct < 0 ? "text-[#6EE7B7]" : "text-[#FF6B6B]")}>{changeLabel(d)}</span>
                      )}
                      <span className="pl-1 text-gold/40">·</span>
                    </span>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse live market" : "Expand live market"}
          className="ad-led-text flex min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-gold/20 px-2 text-pill font-bold tracking-wide uppercase transition-colors active:bg-white/6"
        >
          {expanded ? "Close" : "Expand"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gold/15 px-3 pt-1 pb-3">
          <ul className="m-0 list-none divide-y divide-white/8 p-0">
            {deals.map((d) => (
              <li key={d.id} className="flex min-h-13 items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[13px] leading-tight tracking-tight text-ink uppercase">{d.name}</span>
                  <span className="block truncate text-[11px] text-ink-2">
                    {[d.serve, `usually ${formatGbp(d.basePrice)}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <RollingPrice value={shown(d)} className="font-black text-lg text-gold" />
                  {changeLabel(d) && (
                    <span className={cn("font-black text-[11px] tabular-nums", d.changePct < 0 ? "text-[#6EE7B7]" : "text-[#FF6B6B]")}>
                      {changeLabel(d)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <ArrowCta href="/market" className={cn("mt-2 w-full", crash ? "ad-market-cta-crash" : "ad-market-cta")}>
            Open the market
          </ArrowCta>
        </div>
      )}
    </section>
  );
}
