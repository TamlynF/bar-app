"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatGbp } from "@/lib/price";
import type { MarketEventPayload, MarketInstrumentPayload } from "@/lib/market/tick";

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
      return "Market crash - prices tumbling";
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
