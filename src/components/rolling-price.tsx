"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/* Stock-ticker price: every digit is a column of 0-9 that rolls to the new
   value; the whole price flashes green on a fall (a deal!) and red on a rise
   for a moment after each change. Non-digit characters (£ .) stay put. */
export function RollingPrice({
  value,
  className,
  flashOnChange = true,
}: {
  value: number | null;
  className?: string;
  flashOnChange?: boolean;
}) {
  const text = value == null || !Number.isFinite(value) ? "-" : `£${value.toFixed(2)}`;

  // Derived-from-props previous value (no setState-in-effect): compare during render.
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  if (value !== prev) {
    setPrev(value);
    if (value != null && prev != null) setDir(value > prev ? "up" : value < prev ? "down" : null);
  }
  useEffect(() => {
    if (!dir) return;
    const t = window.setTimeout(() => setDir(null), 900);
    return () => window.clearTimeout(t);
  }, [dir, value]);

  return (
    <span
      className={cn(
        "ad-rolling inline-flex items-baseline tabular-nums transition-colors duration-300",
        flashOnChange && dir === "down" && "ad-flash-down",
        flashOnChange && dir === "up" && "ad-flash-up",
        className
      )}
      aria-label={text}
    >
      {Array.from(text).map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="ad-roll-col relative inline-block h-[1em] w-[0.62em] overflow-hidden" aria-hidden="true">
            <span
              className="ad-roll-strip absolute top-0 left-0 flex flex-col items-center"
              style={{ transform: `translateY(-${Number(ch) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="flex h-[1em] items-center justify-center leading-none">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true" className="leading-none">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
