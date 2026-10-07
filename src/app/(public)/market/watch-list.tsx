"use client";

import { useState } from "react";
import { ArrowRight, BellRing, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MarketInstrumentPayload } from "@/lib/market/tick";
import { titleCase } from "@/lib/title-case";
import { formatDisplayPrice } from "./market-ui";

/* The bells on the drink cards are the only thing that turns alerts on: no
   bell, no alert. This chip counts them and opens a panel listing exactly
   which drinks are being watched. */
export function WatchList({
  instruments,
  watched,
  onToggle,
}: {
  instruments: MarketInstrumentPayload[];
  watched: number[];
  onToggle: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const watching = instruments.filter((instrument) => watched.includes(instrument.id));
  const count = watching.length;
  const nothingPicked = count === 0;

  const chipClass = `flex basis-[calc(50%-0.25rem)] flex-col justify-center rounded-2xl border py-1.5 pr-2 pl-3 text-left ${
    nothingPicked ? "border-[#FF6B35]/40 bg-[#FF6B35]/10" : "border-white/15 bg-[#242c12]"
  }`;
  const headline = nothingPicked ? "No drinks picked" : `Watching ${count} ${count === 1 ? "drink" : "drinks"}`;

  return (
    <>
      {nothingPicked ? (
        <div className={chipClass}>
          <p className="truncate text-meta font-semibold text-[#FF6B35]">{headline}</p>
          <p className="text-pill text-stone-400">Tap a bell on a drink first</p>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${chipClass} min-h-11 transition-colors hover:bg-white/10`}>
          <p className="truncate text-meta font-semibold text-ink">{headline}</p>
          <p className="flex items-center justify-end gap-1 text-pill font-bold tracking-wide text-gold uppercase">
            See list
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </p>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="rounded-3xl border-[#FDCC4B]/20 bg-canvas-2 p-0 text-ink">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <DialogTitle className="text-h3 font-black tracking-tighter text-ink uppercase">
              Watching {count}
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
            You&apos;ll be alerted when any of these drops. Tap a bell to stop watching it.
          </DialogDescription>
          <ul className="max-h-[60vh] divide-y divide-white/10 overflow-y-auto px-5 pb-5 pt-3">
            {watching.map((instrument) => {
              const serve = instrument.serve.trim().toLowerCase() !== "each" ? titleCase(instrument.serve) : null;
              return (
                <li key={instrument.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => onToggle(instrument.id)}
                    aria-label={`Stop watching ${instrument.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gold transition-colors hover:bg-white/5"
                  >
                    <BellRing className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <p className="min-w-0 flex-1 truncate font-ui text-[15px] leading-tight font-bold tracking-wide text-ink uppercase">
                    {instrument.name}
                    {serve && <span className="font-medium normal-case text-stone-400"> ({serve})</span>}
                  </p>
                  <span className="shrink-0 font-display text-xl leading-none tracking-wide text-ink tabular-nums">
                    {formatDisplayPrice(instrument)}
                  </span>
                </li>
              );
            })}
            {count === 0 && (
              <li className="py-6 text-center text-meta text-stone-400">Nothing watched - tap a bell on the board.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
