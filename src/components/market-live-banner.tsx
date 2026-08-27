"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";

/* The homepage caches for five minutes and reads with the anon key, so
   whether a market is trading is asked client-side through the state
   endpoint - the banner is always current and shows nothing when closed. */
export function MarketLiveBanner() {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market/state", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLive(data?.status === "live"))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!live) return null;

  return (
    <div className="mx-auto w-full max-w-400 px-4 sm:px-6 lg:px-10">
      <Link
        href="/market"
        className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-[#FDCC4B]/40 bg-[#FDCC4B]/10 px-4 py-3 transition-colors hover:bg-[#FDCC4B]/15 sm:px-6"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="ad-ping inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#FDCC4B]"
            aria-hidden="true"
          />
          <TrendingUp className="h-5 w-5 shrink-0 text-[#FDCC4B]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-black text-sm tracking-tight text-ink uppercase sm:text-base">
              The drinks market is live
            </span>
            <span className="block truncate text-xs text-stone-400">
              Prices are moving right now - watch them and buy the dips
            </span>
          </span>
        </span>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-[#FDCC4B] transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
