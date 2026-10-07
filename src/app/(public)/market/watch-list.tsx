"use client";

import { useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { formatDisplayPrice } from "./market-ui";

/* The bells on the drink cards are the only thing that turns alerts on: no
   bell, no alert. This row says so, keys the two bell states, and opens a
   panel listing exactly which drinks are being watched. */
export function WatchList({
  instruments,
  watched,
  onToggle,
  alertsOn,
}: {
  instruments: MarketInstrumentPayload[];
  watched: number[];
  onToggle: (id: number) => void;
  alertsOn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const watching = instruments.filter((instrument) => watched.includes(instrument.id));
  const count = watching.length;
  const nothingPicked = count === 0;

  return (
    <>
      <div
        className={`rounded-2xl border px-4 py-3 ${
          nothingPicked && alertsOn ? "border-[#FF6B35]/40 bg-[#FF6B35]/10" : "border-white/10 bg-white/5"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[12px] leading-relaxed text-stone-400">
            <span className={`font-black text-xs tracking-widest uppercase ${nothingPicked && alertsOn ? "text-[#FF6B35]" : "text-ink"}`}>
              {nothingPicked ? "No drinks picked" : `Watching ${count} ${count === 1 ? "drink" : "drinks"}`}
            </span>
            {nothingPicked
              ? " - tap the bell on a drink to get alerts for it. No bells, no alerts."
              : " - you'll only hear about these, plus a market crash."}
          </p>
          {count > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="-my-1 -mr-2 flex min-h-11 shrink-0 items-center rounded-xl px-3 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase transition-colors hover:bg-white/5"
            >
              See list
            </button>
          )}
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
          <div className="flex items-center gap-1.5">
            <dt>
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Grey bell</span>
            </dt>
            <dd>Not watching</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt>
              <BellRing className="h-3.5 w-3.5 text-[#FDCC4B]" aria-hidden="true" />
              <span className="sr-only">Gold ringing bell</span>
            </dt>
            <dd>Watching - alerts on for this drink</dd>
          </div>
        </dl>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="rounded-3xl border-[#FDCC4B]/20 bg-canvas-2 p-0 text-ink">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <DialogTitle className="font-black text-xs tracking-widest text-ink uppercase">
              Watching {count} {count === 1 ? "drink" : "drinks"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-stone-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <DialogDescription className="px-5 pt-1 text-meta text-stone-400">
            You&apos;ll be alerted when any of these drops. Tap the bell to stop watching one.
          </DialogDescription>
          <ul className="max-h-[60vh] divide-y divide-white/10 overflow-y-auto px-5 pb-5 pt-3">
            {watching.map((instrument) => (
              <li key={instrument.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => onToggle(instrument.id)}
                  aria-label={`Stop watching ${instrument.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#FDCC4B] transition-colors hover:bg-white/5"
                >
                  <BellRing className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-[15px] leading-tight font-bold tracking-wide text-ink uppercase">{instrument.name}</p>
                  {instrument.serve.trim().toLowerCase() !== "each" && (
                    <p className="font-ui text-meta text-stone-400">{instrument.serve}</p>
                  )}
                </div>
                <span className="shrink-0 font-display text-xl leading-none tracking-wide text-ink tabular-nums">
                  {formatDisplayPrice(instrument)}
                </span>
              </li>
            ))}
            {count === 0 && (
              <li className="py-6 text-center text-meta text-stone-400">Nothing watched - tap a bell on the board.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
