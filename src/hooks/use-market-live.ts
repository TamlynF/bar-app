"use client";

import { useEffect, useState } from "react";
import type { MarketStatePayload } from "@/lib/market/tick";

const CLOSED_REFRESH_MS = 60_000;
const MIN_LIVE_REFRESH_MS = 10_000;

/* The homepage caches for five minutes and reads with the anon key, so
   market state is polled client-side. While the market trades we poll on the
   session's own tick interval so prices in the UI move with the board. */
export function useMarketState(): MarketStatePayload {
  const [state, setState] = useState<MarketStatePayload>({ status: "closed" });

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, ms);
    };

    const check = () =>
      fetch("/api/market/state", { signal: controller.signal, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: MarketStatePayload | null) => {
          if (controller.signal.aborted) return;
          const next = data?.status === "live" ? data : { status: "closed" as const };
          setState(next);
          schedule(
            next.status === "live"
              ? Math.max(MIN_LIVE_REFRESH_MS, (next.tickIntervalSec ?? 30) * 1000)
              : CLOSED_REFRESH_MS
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) schedule(CLOSED_REFRESH_MS);
        });

    check();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}

export function useMarketLive() {
  return useMarketState().status === "live";
}
