"use client";

import { TrendingUp } from "lucide-react";
import { formatGbp } from "@/lib/price";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { useMarketState } from "../use-market-state";
import {
  DirectionArrow,
  Sparkline,
  directionClass,
  eventCopy,
  formatChangePct,
} from "../market-ui";

function BoardTile({ instrument }: { instrument: MarketInstrumentPayload }) {
  const soldOut = instrument.stock === "out";
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 ${
        soldOut ? "border-[#7a1f2b]/60 bg-[#2b0d14]" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-2xl leading-none tracking-tight text-ink uppercase">
            {instrument.name}
          </p>
          {instrument.serve !== "each" && (
            <p className="mt-1 font-black text-[10px] tracking-[0.3em] text-stone-400 uppercase">
              {instrument.serve}
            </p>
          )}
        </div>
        <DirectionArrow direction={instrument.direction} className="h-8 w-8 shrink-0" />
      </div>

      <Sparkline
        values={instrument.spark}
        className={`my-4 h-10 w-full ${directionClass(instrument.direction)}`}
      />

      <div className="flex items-end justify-between gap-3">
        <p className="font-black text-5xl leading-none tracking-tighter text-ink tabular-nums">
          {formatGbp(instrument.price)}
        </p>
        <p
          className={`pb-1 font-black text-xl tabular-nums ${directionClass(instrument.direction)}`}
        >
          {formatChangePct(instrument.changePct)}
        </p>
      </div>

      {instrument.stock === "low" && !soldOut && (
        <p className="ad-blink mt-3 font-black text-xs tracking-widest text-[#FF6B35] uppercase">
          Running low
        </p>
      )}
      {soldOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2b0d14]/80">
          <p className="-rotate-6 border-4 border-[#ff8fa3] px-4 py-1 font-black text-3xl tracking-widest text-[#ff8fa3] uppercase">
            Sold out
          </p>
        </div>
      )}
    </div>
  );
}

export default function MarketBoard() {
  const { state, feed } = useMarketState(5000);

  if (!state || state.status === "closed") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
        <TrendingUp className="h-16 w-16 text-stone-600" aria-hidden="true" />
        <p className="font-black text-[clamp(3rem,10vw,7rem)] leading-none tracking-tighter text-ink uppercase">
          {state ? "Markets closed" : "Opening…"}
        </p>
        <p className="font-black text-sm tracking-[0.3em] text-stone-500 uppercase">
          Don Fenticas drinks exchange
        </p>
      </div>
    );
  }

  const instruments = state.instruments ?? [];
  const tape = feed.slice(-12);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <p className="font-black text-xl tracking-tight text-ink uppercase sm:text-3xl">
          Don Fenticas <span className="text-[#FDCC4B]">drinks exchange</span>
        </p>
        <p className="flex items-center gap-2 font-black text-xs tracking-widest text-stone-400 uppercase">
          <span className="ad-ping inline-block h-2.5 w-2.5 rounded-full bg-[#FDCC4B]" aria-hidden="true" />
          Live
        </p>
      </header>

      {state.crashActive && (
        <div className="ad-blink border-b border-[#FF6B35]/40 bg-[#FF6B35]/15 px-6 py-3 text-center font-black text-2xl tracking-[0.2em] text-[#FF6B35] uppercase">
          Market crash - buy the dip
        </div>
      )}

      <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] content-start gap-4 p-6">
        {instruments.map((instrument) => (
          <BoardTile key={instrument.id} instrument={instrument} />
        ))}
        {instruments.length === 0 && (
          <p className="col-span-full py-24 text-center font-black text-2xl tracking-widest text-stone-500 uppercase">
            No drinks trading yet
          </p>
        )}
      </div>

      {tape.length > 0 && (
        <footer className="overflow-hidden border-t border-white/10 bg-black/30 py-3">
          <div className="ad-marquee-track [--marquee-duration:45s]">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                {tape.map((event) => (
                  <span
                    key={`${copy}-${event.id}`}
                    className="mx-8 font-black text-sm tracking-widest whitespace-nowrap text-[#FDCC4B] uppercase"
                  >
                    {eventCopy(event)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
