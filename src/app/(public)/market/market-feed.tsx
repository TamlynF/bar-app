"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload } from "@/lib/market/tick";
import { useMarketState } from "./use-market-state";
import {
  DirectionArrow,
  Sparkline,
  StockBadge,
  directionClass,
  eventCopy,
  formatChangePct,
} from "./market-ui";

function systemNotify(events: MarketEventPayload[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  for (const event of events) {
    if (event.kind !== "price_drop" && event.kind !== "out_of_stock" && event.kind !== "low_stock" && event.kind !== "crash") continue;
    try {
      new Notification("Market Night", { body: eventCopy(event) });
    } catch {
      /* some mobile browsers only allow notifications via a service worker */
    }
  }
}

const subscribeNever = () => () => {};
const readNotifyGranted = () =>
  typeof Notification !== "undefined" && Notification.permission === "granted";

export default function MarketFeed() {
  const { state, feed, fresh } = useMarketState();
  const alreadyGranted = useSyncExternalStore(subscribeNever, readNotifyGranted, () => false);
  const [justGranted, setJustGranted] = useState(false);
  const notifyEnabled = alreadyGranted || justGranted;
  const announcedRef = useRef(0);

  useEffect(() => {
    if (fresh.length === 0) return;
    const newest = fresh[fresh.length - 1];
    if (newest.id <= announcedRef.current) return;
    announcedRef.current = newest.id;

    for (const event of fresh) {
      if (event.kind === "price_drop" || event.kind === "crash") {
        toast.success(eventCopy(event));
      } else if (event.kind === "out_of_stock" || event.kind === "low_stock") {
        toast.warning(eventCopy(event));
      } else {
        toast(eventCopy(event));
      }
    }
    systemNotify(fresh);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(150);
    }
  }, [fresh]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setJustGranted(permission === "granted");
    if (permission === "granted") {
      toast.success("You'll be pinged when prices drop while this page is open.");
    }
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-stone-400">
        <TrendingUp className="h-8 w-8 animate-pulse" aria-hidden="true" />
        <p className="font-black text-xs tracking-widest uppercase">Opening the floor…</p>
      </div>
    );
  }

  if (state.status === "closed") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-20 text-center">
        <TrendingUp className="h-10 w-10 text-stone-500" aria-hidden="true" />
        <p className="font-black text-2xl tracking-tighter text-ink uppercase">
          Markets closed
        </p>
        <p className="max-w-xs text-sm text-stone-400">
          The trading floor opens on market nights. Check the schedule and come thirsty.
        </p>
      </div>
    );
  }

  const instruments = state.instruments ?? [];

  return (
    <div className="space-y-8">
      {state.crashActive && (
        <div className="ad-blink rounded-2xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-4 py-3 text-center font-black text-sm tracking-widest text-[#FF6B35] uppercase">
          Market crash - buy the dip
        </div>
      )}

      <button
        type="button"
        onClick={enableNotifications}
        disabled={notifyEnabled}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-4 py-3 font-black text-xs tracking-widest text-[#FDCC4B] uppercase transition-colors hover:bg-[#FDCC4B]/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-stone-400"
      >
        {notifyEnabled ? (
          <>
            <Bell className="h-4 w-4" aria-hidden="true" /> Alerts on
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4" aria-hidden="true" /> Notify me on price drops
          </>
        )}
      </button>

      <ul className="space-y-3">
        {instruments.map((instrument) => (
          <li
            key={instrument.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-sm tracking-tight text-ink uppercase">
                {instrument.name}
              </p>
              <p className="flex items-center gap-2 text-xs text-stone-400">
                {instrument.serve !== "each" && <span>{instrument.serve}</span>}
                <StockBadge stock={instrument.stock} />
              </p>
            </div>
            <Sparkline
              values={instrument.spark}
              className={`h-8 w-20 shrink-0 ${directionClass(instrument.direction)}`}
            />
            <div className="w-24 shrink-0 text-right">
              <p className="font-black text-lg tracking-tight text-ink tabular-nums">
                {formatGbp(instrument.price)}
              </p>
              <p
                className={`flex items-center justify-end gap-0.5 text-xs font-bold tabular-nums ${directionClass(instrument.direction)}`}
              >
                <DirectionArrow direction={instrument.direction} className="h-3.5 w-3.5" />
                {formatChangePct(instrument.changePct)}
              </p>
            </div>
          </li>
        ))}
        {instruments.length === 0 && (
          <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-stone-400">
            No drinks are trading yet.
          </li>
        )}
      </ul>

      {feed.length > 0 && (
        <section>
          <h2 className="mb-3 font-black text-[10px] tracking-[0.3em] text-[#FDCC4B] uppercase">
            Trading floor alerts
          </h2>
          <ul className="space-y-2">
            {[...feed].reverse().map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-ink">{eventCopy(event)}</span>
                <span className="shrink-0 text-[10px] text-stone-500 tabular-nums">
                  {new Date(event.at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[10px] text-stone-500">
        Prices move all night. What the board says is what the bar charges.
      </p>
    </div>
  );
}
