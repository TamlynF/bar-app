"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketEventPayload, MarketStatePayload } from "@/lib/market/tick";

const MAX_FEED_EVENTS = 30;
const SETTLE_WINDOW_SEC = 12;
const SETTLE_POLL_MS = 1000;
const MIN_POLL_MS = 400;

export type MarketStateHook = {
  state: MarketStatePayload | null;
  feed: MarketEventPayload[];
  fresh: MarketEventPayload[];
};

type Arrival = { data: MarketStatePayload; receivedAt: number; events: MarketEventPayload[] };

/* When to ask again. A surface following the ticks polls as the server's
   lead window opens, so its request is the one that runs the tick, then
   every second while the till prices settle (the Square write and its
   confirming webhook trail the engine by a few seconds); otherwise it idles
   on the caller's cadence. */
function nextDelay(data: MarketStatePayload, pollMs: number, followTicks: boolean): number {
  if (!followTicks || data.status !== "live" || data.nextTickInSec == null) return pollMs;
  const interval = data.tickIntervalSec ?? 0;
  const lead = data.tickLeadSec ?? 0;
  const sinceTick = interval - data.nextTickInSec;
  if (interval > 0 && sinceTick < SETTLE_WINDOW_SEC) return SETTLE_POLL_MS;
  return Math.max(MIN_POLL_MS, Math.min(pollMs, (data.nextTickInSec - lead) * 1000 + 100));
}

/* A payload applied after being held has aged: its countdowns were measured
   when it arrived, so take the hold time off before the board reads them. */
function aged(data: MarketStatePayload, receivedAt: number, now: number): MarketStatePayload {
  const heldSec = Math.round((now - receivedAt) / 1000);
  if (heldSec <= 0) return data;
  const shift = (value: number | null | undefined) => (value == null ? value : Math.max(0, value - heldSec));
  return {
    ...data,
    nextTickInSec: shift(data.nextTickInSec) ?? undefined,
    crashRemainingSec: shift(data.crashRemainingSec) ?? undefined,
    nextRerankInSec: shift(data.nextRerankInSec),
  };
}

/* One shared poll loop for the phone feed and the TV board. `feed` is the
   rolling alert history; `fresh` is only the events that arrived after the
   first load - the ones worth a toast or a phone buzz. Polls are chained,
   never overlapped, so a request that ends up running the tick itself is
   allowed to finish before the next one starts.

   With followTicks, a payload carrying a tick the board has not shown yet is
   held until the shown countdown lands, so prices change on the screen at
   zero rather than the moment the early tick finishes. */
export function useMarketState(pollMs: number = 6000, followTicks: boolean = false): MarketStateHook {
  const [state, setState] = useState<MarketStatePayload | null>(null);
  const [feed, setFeed] = useState<MarketEventPayload[]>([]);
  const [fresh, setFresh] = useState<MarketEventPayload[]>([]);
  const lastEventIdRef = useRef<number | null>(null);
  const loadedRef = useRef(false);
  const shownRef = useRef<{ tickNo: number; dueAt: number } | null>(null);
  const heldRef = useRef<Arrival | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    function apply({ data, receivedAt, events }: Arrival) {
      const now = Date.now();
      const shown = aged(data, receivedAt, now);
      setState(shown);
      shownRef.current =
        shown.status === "live" && shown.tickNo != null && shown.nextTickInSec != null
          ? { tickNo: shown.tickNo, dueAt: now + shown.nextTickInSec * 1000 }
          : null;
      if (events.length > 0) {
        setFeed((current) => [...current, ...events].slice(-MAX_FEED_EVENTS));
        if (loadedRef.current) setFresh(events);
      }
      loadedRef.current = true;
    }

    function release() {
      releaseTimer = null;
      const held = heldRef.current;
      heldRef.current = null;
      if (held && !cancelled) apply(held);
    }

    function receive(data: MarketStatePayload) {
      const events = data.events ?? [];
      if (events.length > 0) {
        lastEventIdRef.current = events[events.length - 1].id;
      } else if (lastEventIdRef.current == null && data.status === "live") {
        lastEventIdRef.current = 0;
      }
      const arrival: Arrival = { data, receivedAt: Date.now(), events };

      const shown = shownRef.current;
      const isNewTick =
        followTicks && shown != null && data.status === "live" && data.tickNo != null && data.tickNo > shown.tickNo;
      if (isNewTick && arrival.receivedAt < shown.dueAt) {
        heldRef.current = { ...arrival, events: [...(heldRef.current?.events ?? []), ...events] };
        if (!releaseTimer) releaseTimer = setTimeout(release, shown.dueAt - arrival.receivedAt);
        return;
      }
      if (heldRef.current) {
        arrival.events = [...heldRef.current.events, ...events];
        heldRef.current = null;
        if (releaseTimer) clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      apply(arrival);
    }

    async function poll() {
      let delay = pollMs;
      try {
        const since = lastEventIdRef.current;
        const query = since != null ? `?since=${since}` : "";
        const res = await fetch(`/api/market/state${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as MarketStatePayload;
          if (cancelled) return;
          receive(data);
          delay = nextDelay(data, pollMs, followTicks);
        }
      } catch {
        /* transient network failure - next poll retries */
      }
      if (!cancelled) pollTimer = setTimeout(poll, delay);
    }

    poll();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (releaseTimer) clearTimeout(releaseTimer);
      controller.abort();
    };
  }, [pollMs, followTicks]);

  return { state, feed, fresh };
}
