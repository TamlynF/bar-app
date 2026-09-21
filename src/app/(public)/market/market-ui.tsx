"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload, MarketInstrumentPayload, MarketStatePayload } from "@/lib/market/tick";

/* The price a punter can be charged. A drink linked to Square shows only what
   Square has acknowledged (null until the first sync lands - render as
   "updating"); an unlinked drink has nothing to sync, so the engine price is
   the price. */
export function displayPrice(instrument: Pick<MarketInstrumentPayload, "linkedToTill" | "tillPrice" | "price">): number | null {
  return instrument.linkedToTill ? instrument.tillPrice : instrument.price;
}

export const PRICE_PENDING = "…";

export function formatDisplayPrice(instrument: Pick<MarketInstrumentPayload, "linkedToTill" | "tillPrice" | "price">): string {
  const value = displayPrice(instrument);
  return value == null ? PRICE_PENDING : formatGbp(value);
}

/* Change measured from the price the board is showing, so the pill and the
   price cell always move together. The engine's changePct leads a linked
   drink by a Square round trip; while the till price is still pending there
   is nothing shown to measure, so fall back to the engine's figure. */
export function displayChangePct(
  instrument: Pick<MarketInstrumentPayload, "linkedToTill" | "tillPrice" | "price" | "openingPrice" | "changePct">
): number {
  const value = displayPrice(instrument);
  if (value == null || instrument.openingPrice <= 0) return instrument.changePct;
  return Math.round(((value - instrument.openingPrice) / instrument.openingPrice) * 1000) / 10;
}

export function tierLabel(pct: number | null | undefined): string | null {
  if (pct == null || pct === 0) return null;
  return `${pct > 0 ? "+" : "−"}${Math.round(Math.abs(pct) * 100)}%`;
}

/* Deals first: −30% … −10%, then the unchanged middle, then the mark-ups
   ending on +30%; inside a tier the drink furthest into its discount (lowest
   pace) leads. Demand mode keeps the server's order. */
export function sortForPhone(
  instruments: MarketInstrumentPayload[],
  pricingMode: MarketStatePayload["pricingMode"]
): MarketInstrumentPayload[] {
  if (pricingMode !== "tiers") return instruments;
  return [...instruments].sort((a, b) => {
    const tierA = a.tierPct ?? 0;
    const tierB = b.tierPct ?? 0;
    if (tierA !== tierB) return tierA - tierB;
    const paceA = a.pace ?? 0;
    const paceB = b.pace ?? 0;
    if (paceA !== paceB) return tierA <= 0 ? paceA - paceB : paceB - paceA;
    return a.name.localeCompare(b.name);
  });
}

export function TierBadge({ pct, className }: { pct: number | null | undefined; className?: string }) {
  const label = tierLabel(pct);
  if (!label) return null;
  const up = (pct ?? 0) > 0;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-black text-[10px] tracking-widest uppercase ${
        up ? "bg-[#FF4D6D]/15 text-[#FF4D6D]" : "bg-[#8CFF6A]/15 text-[#8CFF6A]"
      } ${className ?? ""}`}
    >
      {up ? "Top seller" : "Deal"} {label}
    </span>
  );
}

const FLIP_STEP_MS = 70;

function isDigit(glyph: string): boolean {
  return glyph >= "0" && glyph <= "9";
}

function glyphSequence(from: string, to: string): string[] {
  if (from === to) return [];
  if (!isDigit(from) || !isDigit(to)) return [to];
  const sequence: string[] = [];
  let current = Number(from);
  const target = Number(to);
  while (current !== target) {
    current = (current + 1) % 10;
    sequence.push(String(current));
  }
  return sequence;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

/* Odometer-style price: each digit rolls up through the intermediate
   numbers, staggered left to right, so a change reads like a split-flap
   board. Reduced motion snaps straight to the new value. */
export function FlipPrice({ value, className }: { value: string; className?: string }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const [target, setTarget] = useState(value);
  const displayedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (value !== target) {
    setTarget(value);
    if (reducedMotion) setDisplayed(value);
  }

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (reducedMotion) {
      displayedRef.current = value;
      return;
    }

    const start = displayedRef.current;
    if (start === value) return;
    const startGlyphs = Array.from({ length: value.length }, (_, index) => start[index] ?? "0");
    const sequences = startGlyphs.map((glyph, index) => glyphSequence(glyph, value[index]));
    const totalSteps = Math.max(
      0,
      ...sequences.map((sequence, index) => (sequence.length === 0 ? 0 : sequence.length + index))
    );
    if (totalSteps === 0) return;

    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= totalSteps) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        displayedRef.current = value;
        setDisplayed(value);
        return;
      }
      const frame = sequences
        .map((sequence, index) => {
          const progress = step - index;
          if (progress <= 0 || sequence.length === 0) return startGlyphs[index];
          return sequence[Math.min(progress, sequence.length) - 1];
        })
        .join("");
      displayedRef.current = frame;
      setDisplayed(frame);
    }, FLIP_STEP_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [value, reducedMotion]);

  return (
    <span className={className} aria-label={value}>
      {Array.from(displayed).map((glyph, index) => (
        <span
          key={`${index}-${glyph}`}
          aria-hidden="true"
          className={isDigit(glyph) ? "ad-flap inline-block w-[1ch] text-center" : "ad-flap"}
        >
          {glyph === " " ? "\u00A0" : glyph}
        </span>
      ))}
    </span>
  );
}

export function formatChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function eventCopy(event: MarketEventPayload): string {
  const name = [event.name, event.serve && event.serve !== "each" ? event.serve : null]
    .filter(Boolean)
    .join(" · ");
  switch (event.kind) {
    case "price_drop":
      return `${name} down to ${formatGbp(event.to)}${event.pct != null ? ` (${formatChangePct(event.pct)})` : ""}`;
    case "surge":
      return `${name} surging to ${formatGbp(event.to)}${event.pct != null ? ` (${formatChangePct(event.pct)})` : ""}`;
    case "low_stock":
      return `${name} running low`;
    case "out_of_stock":
      return `${name} sold out`;
    case "restock":
      return `${name} back on the bar`;
    case "crash":
      return name ? `${name} crashing - buy the dip` : "Market crash - prices tumbling";
    case "tier_up":
      return `${name} climbing the board${event.pct != null ? ` - heading ${formatChangePct(event.pct)}` : ""}`;
    case "tier_down":
      return `${name} sliding down the board${event.pct != null ? ` - heading ${formatChangePct(event.pct)}` : ""}`;
    case "rerank":
      return "Board re-ranked - new deals on";
    case "warmup_done":
      return "Market open - prices now moving";
  }
}

export function directionClass(direction: MarketInstrumentPayload["direction"]): string {
  if (direction === "up") return "text-[#FF4D6D]";
  if (direction === "down") return "text-[#8CFF6A]";
  return "text-stone-400";
}

export function DirectionArrow({
  direction,
  className,
}: {
  direction: MarketInstrumentPayload["direction"];
  className?: string;
}) {
  const classes = `${className ?? "h-4 w-4"} ${directionClass(direction)}`;
  if (direction === "up") return <ArrowUpRight className={classes} aria-label="Rising" />;
  if (direction === "down")
    return <ArrowDownRight className={classes} aria-label="Falling" />;
  return <Minus className={classes} aria-label="Unchanged" />;
}

export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) {
    return <span className={className} aria-hidden="true" />;
  }
  const width = 100;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StockBadge({ stock }: { stock: MarketInstrumentPayload["stock"] }) {
  if (stock === "out") {
    return (
      <span className="rounded-full bg-[#4a1220] px-2 py-0.5 font-black text-[10px] tracking-widest text-[#ff8fa3] uppercase">
        Sold out
      </span>
    );
  }
  if (stock === "low") {
    return (
      <span className="ad-blink rounded-full bg-[#FF6B35]/15 px-2 py-0.5 font-black text-[10px] tracking-widest text-[#FF6B35] uppercase">
        Running low
      </span>
    );
  }
  return null;
}
