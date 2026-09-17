"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const AUTO_PEEK_MS = 1500;

/* A record on a shelf: the sleeve (children) sits in front, a vinyl disc
   behind it slides out and turns on hover, keyboard focus, a tap, and once
   as the card scrolls into view on touch screens. Motion is transform-only. */
export function VinylPeek({
  color,
  className,
  children,
}: {
  color: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const touch = window.matchMedia("(hover: none)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!touch || still) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        setPeeking(true);
        timer = window.setTimeout(() => setPeeking(false), AUTO_PEEK_MS);
      },
      { threshold: 0.85 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.pointerType !== "mouse" && setPeeking(true)}
      className={cn("ad-vinyl", peeking && "ad-vinyl-peeking", className)}
      style={{ "--ev-c": color } as React.CSSProperties}
    >
      <div className="ad-vinyl-disc" aria-hidden="true">
        <div className="ad-vinyl-face">
          <span className="ad-vinyl-label" />
        </div>
      </div>
      <div className="ad-vinyl-sleeve">{children}</div>
    </div>
  );
}
