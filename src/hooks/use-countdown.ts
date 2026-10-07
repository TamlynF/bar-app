"use client";

import { useSyncExternalStore } from "react";
import { secondsLeft } from "@/lib/market/countdown";

const TICK_MS = 200;

let nowMs = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(() => {
      nowMs = Date.now();
      emit();
    }, TICK_MS);
  }
  nowMs = Date.now();
  listener();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getNow = () => nowMs;
const getServerNow = () => 0;

/* Whole seconds until an absolute server deadline, on this device's clock
   once its offset from the server is taken off. One shared ticker drives
   every countdown on the page, so the board's header, the phone's status row
   and the trade floor all change on the same frame. Null when there is
   nothing to count down to or before the first client tick. */
export function useCountdown(deadline: string | null | undefined, clockOffsetMs: number = 0): number | null {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  if (deadline == null || now === 0) return null;
  const endsAt = Date.parse(deadline);
  if (Number.isNaN(endsAt)) return null;
  return secondsLeft(endsAt + clockOffsetMs, now);
}
