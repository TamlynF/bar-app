"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketStatePayload } from "@/lib/market/tick";

const LIVE_POLL_MS = 5000;

/* Polls the state endpoint while a market is live and hands back the latest
   payload; the caller lays it over its server props with
   mergeLiveInstruments. The only callback is when the market turns out to
   have closed since the page rendered, which is the one change the payload
   cannot express and the page has to re-fetch for. */
export function useLiveTick(enabled: boolean, onClosed?: () => void): MarketStatePayload | null {
  const [state, setState] = useState<MarketStatePayload | null>(null);
  const onClosedRef = useRef(onClosed);
  const closedHandledRef = useRef(false);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    closedHandledRef.current = false;

    async function poll() {
      try {
        const res = await fetch("/api/market/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MarketStatePayload;
        if (cancelled) return;
        setState(data);
        if (data.status === "closed" && !closedHandledRef.current) {
          closedHandledRef.current = true;
          onClosedRef.current?.();
        }
      } catch {
        /* transient network failure - next poll retries */
      }
    }

    poll();
    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return state;
}
