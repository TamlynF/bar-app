"use client";

import { useEffect, useRef } from "react";
import type { MarketStatePayload } from "@/lib/market/tick";
import { useMarketState } from "@/app/(public)/market/use-market-state";

const LIVE_POLL_MS = 5000;

/* The trade floor follows the same poll loop as the TV board and the phone
   feed: a payload carrying a tick the countdown has not reached yet is held
   until it lands, so prices and the clock change on every surface at the
   same moment. The caller lays the payload over its server props with
   mergeLiveInstruments. The only callback is when the market turns out to
   have closed since the page rendered, which is the one change the payload
   cannot express and the page has to re-fetch for. */
export function useLiveTick(onClosed?: () => void): MarketStatePayload | null {
  const { state } = useMarketState(LIVE_POLL_MS, true);
  const onClosedRef = useRef(onClosed);
  const closedHandledRef = useRef(false);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    if (state?.status === "closed" && !closedHandledRef.current) {
      closedHandledRef.current = true;
      onClosedRef.current?.();
    }
  }, [state]);

  return state;
}
