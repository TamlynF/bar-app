"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FAN: { rotate: number; x: number; y: number; delay: number }[] = [
  { rotate: -3, x: -24, y: 0, delay: 150 },
  { rotate: 0, x: 0, y: -4, delay: 250 },
  { rotate: 3, x: 24, y: 0, delay: 350 },
];

/* Up to three cards that start as one stack and fan out as they scroll into
   view, like flicking through a crate of records: card 1 turns -3deg and
   slides 24px left at 150ms, card 2 lifts 4px at 250ms, card 3 turns +3deg
   and slides 24px right at 350ms. Transform-only, once, reduced-motion
   aware. */
export function FanOutCards({
  cards,
  className,
  cardClassName,
}: {
  cards: ReactNode[];
  className?: string;
  cardClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setOut(true);
        observer.disconnect();
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stack = cards.slice(0, FAN.length);

  return (
    <div ref={ref} className={cn("ad-fan relative", out && "ad-fan-out", className)}>
      {stack.map((card, i) => (
        <div
          key={i}
          className={cn("ad-fan-card", cardClassName)}
          style={
            {
              "--fan-r": `${FAN[i].rotate}deg`,
              "--fan-x": `${FAN[i].x}px`,
              "--fan-y": `${FAN[i].y}px`,
              "--fan-delay": `${FAN[i].delay}ms`,
              zIndex: i === 1 ? 3 : 2 - Math.abs(i - 1),
            } as React.CSSProperties
          }
        >
          {card}
        </div>
      ))}
    </div>
  );
}
