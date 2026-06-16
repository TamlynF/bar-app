"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal "collection" slider (awwwards-style): a scroll-snap row of cards
 * with optional prev/next buttons on desktop. Mobile uses native touch
 * scrolling. Children are the slides (each should be `shrink-0` / sized).
 */
export function Slider({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0"
        aria-label={ariaLabel}
      >
        {children}
      </div>

      {/* Desktop nav buttons */}
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Scroll left"
        className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center bg-[#26300D] border border-white/15 text-white hover:bg-[#FDCC4B] hover:text-[#1a2008] active:scale-95 transition-colors shadow-lg shadow-black/30"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Scroll right"
        className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center bg-[#26300D] border border-white/15 text-white hover:bg-[#FDCC4B] hover:text-[#1a2008] active:scale-95 transition-colors shadow-lg shadow-black/30"
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}
