"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload, MarketInstrumentPayload } from "@/lib/market/tick";

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
          {glyph}
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
  }
}

export function directionClass(direction: MarketInstrumentPayload["direction"]): string {
  if (direction === "up") return "text-[#FDCC4B]";
  if (direction === "down") return "text-[#FF6B35]";
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
