"use client";

import Link from "next/link";
import { ArrowRight, TrendingDown, Zap } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { RollingPrice } from "@/components/rolling-price";
import { Sparkline } from "@/components/sparkline";
import { useMarketState } from "@/hooks/use-market-live";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload } from "@/lib/market/tick";

const MAX_MOVERS = 4;

function shown(i: MarketInstrumentPayload) {
  return i.tillPrice ?? i.price;
}
function headlineDeal(instruments: MarketInstrumentPayload[]) {
  const pool = instruments.filter((i) => i.stock !== "out");
  const src = pool.length ? pool : instruments;
  if (!src.length) return null;
  const dropped = src.filter((i) => i.changePct < 0);
  if (dropped.length) return dropped.reduce((a, b) => (b.changePct < a.changePct ? b : a));
  return src.reduce((a, b) => (b.price < a.price ? b : a));
}
function trend(pct: number) {
  return pct < 0 ? "#6EE7B7" : pct > 0 ? "#FF6B6B" : "#FDCC4B";
}

/* Home-page section for the drinks market while it trades: best deal with
   its session chart, the biggest movers, and the way in. Tablet/desktop only -
   phones use the floating pill + sheet instead. Renders nothing when closed. */
export function MarketSection() {
  const state = useMarketState();
  if (state.status !== "live") return null;

  const instruments = state.instruments ?? [];
  const deal = headlineDeal(instruments);
  const movers = [...instruments]
    .filter((i) => i.stock !== "out" && i.id !== deal?.id)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_MOVERS);
  const crash = state.crashActive;

  return (
    <section id="market" aria-labelledby="market-heading" className="hidden scroll-mt-24 sm:block">
      <SectionHeading
        id="market-heading"
        eyebrow={crash ? "At the bar · crash on" : "At the bar · open now"}
        title="Drinks market"
        action={{ href: "/market", label: "Open the market" }}
      />

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:gap-5">
        {/* Best deal */}
        {deal && (
          <Link
            href="/market"
            className={cn(
              "group relative overflow-hidden rounded-3xl border p-5 transition-transform hover:-translate-y-0.5 sm:p-6",
              crash ? "border-[#FF6B6B]/30 bg-[#7A1F1F]/20" : "border-gold/30 bg-gold/6"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-[0.24em] text-gold uppercase">
                  <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
                  {crash ? "Everything's down" : "Best deal right now"}
                </p>
                <p className="mt-2 truncate font-black text-2xl leading-none tracking-tighter text-ink uppercase sm:text-3xl">
                  {deal.name}
                </p>
                <p className="mt-1 text-xs text-ink-2">
                  {deal.serve} · usually {formatGbp(deal.basePrice)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <RollingPrice value={shown(deal)} className="font-black text-4xl text-gold sm:text-5xl" />
                <p className="mt-1 font-black text-sm tabular-nums" style={{ color: trend(deal.changePct) }}>
                  {deal.changePct < 0 ? "↓" : deal.changePct > 0 ? "↑" : ""}
                  {Math.abs(Math.round(deal.changePct))}%
                </p>
              </div>
            </div>
            <Sparkline points={deal.spark} stroke={trend(deal.changePct)} className="mt-4 h-20 w-full" />
            <span className="mt-3 inline-flex items-center gap-2 font-black text-[11px] tracking-[0.16em] text-ink uppercase">
              {crash ? <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5 text-gold" aria-hidden="true" />}
              Buy at the bar for this price
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        )}

        {/* Movers */}
        <ul className="divide-y divide-white/8 rounded-3xl border border-white/10 bg-canvas-2/70">
          {movers.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <Sparkline points={i.spark} width={56} height={22} stroke={trend(i.changePct)} className="h-[22px] w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm tracking-tight text-ink uppercase">{i.name}</p>
                <p className="truncate text-[11px] text-ink-2">{i.category ?? i.serve}</p>
              </div>
              <div className="text-right">
                <RollingPrice value={shown(i)} className="font-black text-base text-ink" />
                <p className="font-black text-[11px] tabular-nums" style={{ color: trend(i.changePct) }}>
                  {i.changePct < 0 ? "↓" : i.changePct > 0 ? "↑" : "·"}
                  {Math.abs(Math.round(i.changePct))}%
                </p>
              </div>
            </li>
          ))}
          <li className="px-4 py-3 text-[11px] text-ink-2">
            Prices move every {state.tickIntervalSec ?? 30}s with what people are buying. The till charges the price shown.
          </li>
        </ul>
      </div>
    </section>
  );
}
