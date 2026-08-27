"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketEventPayload, MarketStatePayload } from "@/lib/market/tick";

const MAX_FEED_EVENTS = 30;

export type MarketStateHook = {
  state: MarketStatePayload | null;
  feed: MarketEventPayload[];
  fresh: MarketEventPayload[];
};

/* One shared poll loop for the phone feed and the TV board. `feed` is the
   rolling alert history; `fresh` is only the events that arrived after the
   first load - the ones worth a toast or a phone buzz. */
export function useMarketState(pollMs: number = 6000): MarketStateHook {
  const [state, setState] = useState<MarketStatePayload | null>(null);
  const [feed, setFeed] = useState<MarketEventPayload[]>([]);
  const [fresh, setFresh] = useState<MarketEventPayload[]>([]);
  const lastEventIdRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    async function poll() {
      controller?.abort();
      controller = new AbortController();
      try {
        const since = lastEventIdRef.current;
        const query = since != null ? `?since=${since}` : "";
        const res = await fetch(`/api/market/state${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as MarketStatePayload;
        if (cancelled) return;

        setState(data);
        const events = data.events ?? [];
        if (events.length > 0) {
          lastEventIdRef.current = events[events.length - 1].id;
          setFeed((current) => [...current, ...events].slice(-MAX_FEED_EVENTS));
          if (loadedRef.current) setFresh(events);
        } else if (lastEventIdRef.current == null && data.status === "live") {
          lastEventIdRef.current = 0;
        }
        loadedRef.current = true;
      } catch {
        /* transient network failure - next poll retries */
      }
    }

    poll();
    const interval = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller?.abort();
    };
  }, [pollMs]);

  return { state, feed, fresh };
}
