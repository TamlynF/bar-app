"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 60_000;

let current: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    current = Date.now();
    listeners.forEach((notify) => notify());
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    timer = undefined;
    current = null;
  };
}

function getSnapshot() {
  return (current ??= Date.now());
}

function getServerSnapshot() {
  return null;
}

/* The current time for render-time comparisons ("has this event ended?"),
   refreshed every minute. Null on the server and during hydration, so
   callers fall back to a date-only check rather than baking a stale server
   clock into the HTML. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
