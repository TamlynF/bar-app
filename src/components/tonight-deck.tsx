"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PosterCard } from "@/components/poster-card";
import { cn } from "@/lib/utils";
import type { SerializedEvent } from "@/lib/events-display";

const SWIPE_PX = 70;
const DRAG_START_PX = 8;
const MAX_VISIBLE = 4;

/* Several events on one night: the poster cards are held like a hand of
   cards - front card square, the rest fanned behind it to the right. Swipe
   (or drag with a mouse) to send the front card to the back; arrows, dots
   and the keyboard do the same. */
export function TonightDeck({
  events,
  isTonight,
}: {
  events: SerializedEvent[];
  isTonight: boolean;
}) {
  const [rawActive, setActive] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; live: boolean }>({ dx: 0, live: false });
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const count = events.length;
  const active = rawActive % count;

  const go = useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + count) % count),
    [count]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!moved.current) {
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy)) return;
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag({ dx, live: true });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    start.current = null;
    if (moved.current) {
      if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
    setDrag({ dx: 0, live: false });
  };
  // A drag must not fall through as a click on the card's link/button.
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  return (
    <div className="relative mr-auto ml-0 w-[86%] max-w-md md:w-[84%] md:max-w-sm lg:max-w-[22rem] xl:max-w-sm">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${count} events tonight`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className="ad-deck relative aspect-4/3 w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas sm:aspect-[4/4.4]"
      >
        {events.map((event, i) => {
          const pos = (i - active + count) % count; // 0 = front
          const hidden = pos >= MAX_VISIBLE;
          const isFront = pos === 0;
          const dx = isFront && drag.live ? drag.dx : 0;
          const tilt = isFront ? dx / 24 : pos * 5;
          const shiftX = isFront ? dx : pos * 14;
          const shiftY = isFront ? Math.abs(dx) * 0.06 : pos * -4;
          const scale = isFront ? 1 : 1 - pos * 0.05;
          return (
            <div
              key={event.id}
              aria-hidden={!isFront}
              className={cn(
                "absolute inset-0 origin-bottom will-change-transform",
                !drag.live && "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                hidden && "opacity-0"
              )}
              style={{
                zIndex: count - pos,
                transform: `translate(${shiftX}${isFront ? "px" : "%"}, ${shiftY}${isFront ? "px" : "%"}) rotate(${tilt}deg) scale(${scale})`,
                opacity: hidden ? 0 : 1 - pos * 0.08,
                pointerEvents: isFront ? "auto" : "none",
              }}
            >
              <PosterCard event={event} isTonight={isTonight} priority={pos < 2} className="h-full" />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 md:absolute md:inset-x-0 md:top-full md:mt-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous event"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-ink transition-colors hover:border-gold/60 hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Events tonight">
            {events.map((event, i) => (
              <button
                key={event.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={event.title}
                onClick={() => setActive(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === active ? "w-6 bg-gold" : "w-2 bg-white/25 hover:bg-white/50"
                )}
              />
            ))}
          </div>
          <p className="truncate font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">
            {active + 1} / {count} tonight · swipe
          </p>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next event"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-ink transition-colors hover:border-gold/60 hover:text-gold"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
