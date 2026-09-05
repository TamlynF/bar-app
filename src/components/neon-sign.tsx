"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* The bar's offer as a neon sign on a dark slatted board: one tube lit at a
   time with a soft flicker, the others glowing faintly so the whole list
   still reads. Colours follow the event-type palette used on badges. Static
   (all lit, no flicker) under prefers-reduced-motion. */

const DEFAULT_WORDS = [
  "Live music",
  "Quiz Thursday",
  "DJ sets",
  "Open mic",
  "World famous karaoke",
  "Open until 2am",
];

/* gold, quiz pink, DJ orange, football green, karaoke blue, cream */
const TUBE_COLOURS = ["#FDCC4B", "#E97CF0", "#FF8A3D", "#6EE7B7", "#7FD0FF", "#FFF4CC"];

const STEP_MS = 3000;

export function NeonSign({ words }: { words?: string[] }) {
  const tubes = words?.length ? words : DEFAULT_WORDS;
  const [lit, setLit] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced || tubes.length < 2) return;
    const t = window.setInterval(() => setLit((i) => (i + 1) % tubes.length), STEP_MS);
    return () => window.clearInterval(t);
  }, [reduced, tubes.length]);

  return (
    <section aria-label="What we do" className="ad-neon-board relative">
      <ul className="relative mx-auto flex max-w-400 flex-wrap items-center justify-center gap-x-5 gap-y-2.5 px-4 py-5 sm:gap-x-8 sm:gap-y-3 sm:py-6 lg:px-10">
        {tubes.map((word, i) => (
          <li
            key={word}
            style={{ "--tube-c": TUBE_COLOURS[i % TUBE_COLOURS.length] } as React.CSSProperties}
            className={cn(
              "ad-tube font-black text-[17px] leading-none tracking-[0.06em] whitespace-nowrap uppercase sm:text-2xl lg:text-[26px]",
              (reduced || i === lit) && "ad-tube-on",
              !reduced && i === lit && "ad-tube-flicker"
            )}
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}
