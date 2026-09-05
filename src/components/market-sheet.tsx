"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { RollingPrice } from "@/components/rolling-price";
import { Sparkline } from "@/components/sparkline";
import { formatGbp } from "@/lib/price";
import { cn } from "@/lib/utils";
import type { MarketInstrumentPayload, MarketStatePayload } from "@/lib/market/tick";

const MAX_MOVERS = 6;

function shown(i: MarketInstrumentPayload) {
  return i.tillPrice ?? i.price;
}

/* Bottom sheet with the market at a glance: the headline deal with its
   session chart, then the biggest movers with rolling prices. Prices keep
   ticking while it is open. */
export function MarketSheet({
  state,
  deal,
  open,
  onClose,
}: {
  state: MarketStatePayload;
  deal: MarketInstrumentPayload | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const instruments = state.instruments ?? [];
  const movers = [...instruments]
    .filter((i) => i.stock !== "out")
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_MOVERS);
  const crash = state.crashActive;

  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Drinks market">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ad-sheet-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="ad-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-canvas pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-30px_60px_rgba(0,0,0,0.6)]">
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />

        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-[0.24em] text-gold uppercase">
              <span className="ad-live-dot h-1.5 w-1.5 rounded-full bg-[#E6392E]" aria-hidden="true" />
              {crash ? "Market crash" : "Drinks market open"}
            </p>
            <h2 className="mt-1 font-black text-2xl leading-none tracking-tighter text-ink uppercase">
              {crash ? "Everything's down" : "Buy the dips"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {deal && (
          <section className="mx-5 mt-4 rounded-2xl border border-gold/25 bg-gold/6 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">Best deal right now</p>
                <p className="mt-1 truncate font-black text-lg leading-tight tracking-tight text-ink uppercase">{deal.name}</p>
                {deal.serve && <p className="text-xs text-ink-2">{deal.serve}</p>}
              </div>
              <div className="text-right">
                <RollingPrice value={shown(deal)} className="font-black text-3xl text-gold" />
                <p className={cn("mt-0.5 font-black text-xs tabular-nums", deal.changePct < 0 ? "text-[#6EE7B7]" : deal.changePct > 0 ? "text-[#FF6B6B]" : "text-ink-2")}>
                  {deal.changePct < 0 ? "↓" : deal.changePct > 0 ? "↑" : ""}
                  {Math.abs(Math.round(deal.changePct))}% vs usual {formatGbp(deal.basePrice)}
                </p>
              </div>
            </div>
            <Sparkline
              points={deal.spark}
              stroke={deal.changePct < 0 ? "#6EE7B7" : deal.changePct > 0 ? "#FF6B6B" : "#FDCC4B"}
              className="mt-3 h-16 w-full"
            />
          </section>
        )}

        {movers.length > 0 && (
          <section className="mt-4 px-5">
            <p className="mb-2 font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">Biggest movers</p>
            <ul className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-canvas-2/70">
              {movers.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <Sparkline
                    points={i.spark}
                    width={56}
                    height={22}
                    stroke={i.changePct < 0 ? "#6EE7B7" : i.changePct > 0 ? "#FF6B6B" : "#FDCC4B"}
                    className="h-[22px] w-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-sm tracking-tight text-ink uppercase">{i.name}</p>
                    <p className="truncate text-[11px] text-ink-2">{i.category ?? i.serve}</p>
                  </div>
                  <div className="text-right">
                    <RollingPrice value={shown(i)} className="font-black text-base text-ink" />
                    <p className={cn("font-black text-[11px] tabular-nums", i.changePct < 0 ? "text-[#6EE7B7]" : i.changePct > 0 ? "text-[#FF6B6B]" : "text-ink-2")}>
                      {i.changePct < 0 ? "↓" : i.changePct > 0 ? "↑" : "·"}
                      {Math.abs(Math.round(i.changePct))}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="px-5 pt-5">
          <Link
            href="/market"
            className="ad-market-cta flex min-h-13 items-center justify-center gap-2 rounded-2xl font-black text-sm tracking-[0.12em] text-on-gold uppercase shadow-[0_3px_0_#a8801c] active:translate-y-[3px] active:shadow-none"
          >
            Open the full market
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-2.5 text-center text-[11px] text-ink-2">
            Prices update every {state.tickIntervalSec ?? 30} seconds · the till charges the price shown
          </p>
        </div>
      </div>
    </div>
  );
}
