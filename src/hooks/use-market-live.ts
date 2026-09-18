"use client";

import { useSyncExternalStore } from "react";
import type { MarketStatePayload } from "@/lib/market/tick";

const CLOSED_REFRESH_MS = 10_000;
const MIN_LIVE_REFRESH_MS = 10_000;
const CLOSED: MarketStatePayload = { status: "closed" };

let state: MarketStatePayload = CLOSED;
const listeners = new Set<() => void>();
let timer: number | undefined;
let inFlight: AbortController | null = null;

function emit() {
  for (const l of listeners) l();
}

function schedule(ms: number) {
  window.clearTimeout(timer);
  timer = window.setTimeout(check, ms);
}

function check() {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;
  fetch("/api/market/state", { signal: controller.signal, cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: MarketStatePayload | null) => {
      if (controller.signal.aborted) return;
      const next = data?.status === "live" ? data : CLOSED;
      if (next !== state) {
        state = next;
        emit();
      }
      schedule(
        next.status === "live"
          ? Math.max(MIN_LIVE_REFRESH_MS, (next.tickIntervalSec ?? 30) * 1000)
          : CLOSED_REFRESH_MS
      );
    })
    .catch(() => {
      if (!controller.signal.aborted) schedule(CLOSED_REFRESH_MS);
    });
}

function onVisible() {
  if (document.visibilityState === "visible") check();
}

function start() {
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("pageshow", onVisible);
  check();
}

function stop() {
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("focus", onVisible);
  window.removeEventListener("pageshow", onVisible);
  window.clearTimeout(timer);
  inFlight?.abort();
  inFlight = null;
  state = CLOSED;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => CLOSED;

/* The homepage caches for five minutes and reads with the anon key, so
   market state is polled client-side. One poll loop feeds every consumer on
   the page: while closed it checks every ten seconds and again the moment
   the tab comes back into view, so the ticker appears as soon as staff open
   the market; while live it follows the session's own tick interval. */
export function useMarketState(): MarketStatePayload {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useMarketLive() {
  return useMarketState().status === "live";
}
