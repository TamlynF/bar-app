"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowDown, Clock } from "lucide-react";
import { BookingButton } from "@/components/editorial/booking-button";
import { EventActions } from "@/components/event-actions";
import { MarketHeroCard } from "@/components/market-hero-card";
import { cn } from "@/lib/utils";
import { entryText, formatGBP, parseDate, type SerializedEvent } from "@/lib/events-display";

/* The first screen: one act fills it like a gig poster. Tonight's headline
   act when there is one, otherwise the next event with a "Next up" pill and
   a line saying the bar is still open. With several events on the night the
   rest sit in a bill card (desktop, bottom-right) and choosing one swaps the
   poster in place; phones list them under the hero (AlsoOnList). */
export function PosterHero({
  nightEvents,
  isTonight,
  doors,
  openTonight,
  moreNights,
}: {
  nightEvents: SerializedEvent[];
  isTonight: boolean;
  doors: string | null;
  openTonight: string | null;
  moreNights: number;
}) {
  const [active, setActive] = useState(0);
  const event = nightEvents[Math.min(active, nightEvents.length - 1)];
  const light = useLightBackdrop(event?.imageUrl ?? null);
  if (!event) return null;

  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  const acts = nightEvents.length;
  const daysAway = Math.round((dateObj.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  const whenTail = isTonight
    ? [acts > 1 ? `${acts} acts` : null, doors ? `doors ${doors}` : null].filter(Boolean).join(" · ")
    : `${format(dateObj, "EEE d MMM")}${acts > 1 ? ` · ${acts} events` : daysAway === 1 ? " · tomorrow" : daysAway > 1 ? ` · in ${daysAway} days` : ""}`;
  const paid = event.price != null && event.price > 0;
  const longestWord = Math.max(...event.title.split(/\s+/).map((word) => word.length), 1);
  const titleChars = Math.max(event.title.replace(/\s+/g, "").length, 1);

  return (
    <section
      id="tonight"
      aria-label={isTonight ? "Tonight" : "Next up"}
      className="relative h-160 overflow-hidden md:h-205"
      style={
        { "--ev-c": event.color, "--title-chars": longestWord, "--title-total": titleChars } as React.CSSProperties
      }
    >
      {event.imageUrl ? (
        <Image
          key={event.id}
          src={event.imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="animate-reveal object-cover object-[center_25%]"
        />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-(--ev-c)/45 via-canvas-2 to-canvas" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-linear-to-br from-[#7A1F1F]/35 via-[#4A2A14]/20 to-[#26300D]/35 mix-blend-multiply" aria-hidden="true" />
      <div className="absolute inset-0 bg-linear-to-b from-canvas/55 via-canvas/0 via-22% to-canvas" aria-hidden="true" />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-[62%] bg-linear-to-t from-canvas via-canvas/70 to-transparent transition-opacity duration-500",
          light ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
      <div className="absolute inset-0 hidden bg-linear-to-r from-canvas/75 via-canvas/25 via-45% to-transparent md:block" aria-hidden="true" />

      {/* Everything on the poster shares the page container so it lines up with the sections below */}
      <div className="absolute inset-0 mx-auto w-full max-w-400">
      {/* Live / next-up pill */}
      <div className="absolute top-19 left-4 flex flex-col items-start gap-2.5 sm:top-22 sm:left-6 lg:left-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-canvas/70 py-1.5 pr-3 pl-2.5 backdrop-blur-md sm:gap-2.5 sm:py-2 sm:pr-3.5 sm:pl-3">
          {isTonight && <span className="ad-live-dot h-2 w-2 rounded-full bg-neon sm:h-2.5 sm:w-2.5" aria-hidden="true" />}
          <span className={cn("font-black text-[10px] tracking-[0.22em] uppercase sm:text-xs", isTonight ? "text-ink" : "text-gold")}>
            {isTonight ? "Live tonight" : "Next up"}
          </span>
          {whenTail && (
            <>
              <span className="h-3 w-px bg-ink/25" aria-hidden="true" />
              <span className={cn("text-[11px] font-bold tabular-nums sm:text-[13px]", isTonight ? "text-ink-2" : "text-ink")}>{whenTail}</span>
            </>
          )}
        </p>
        {!isTonight && openTonight && (
          <p className="inline-flex items-center gap-2 text-[11px] font-bold text-ink-2 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)] sm:text-[13px]">
            <Clock className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
            {openTonight}
          </p>
        )}
      </div>

      {/* Poster copy */}
      <div className="absolute right-4 bottom-14.5 left-4 flex flex-col gap-3 sm:right-6 sm:left-6 md:right-auto md:bottom-16 md:w-[60%] md:gap-5 lg:left-10">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {event.subType && (
            <span className="rounded-md bg-(--ev-c) px-2 py-1 font-black text-[10px] tracking-[0.18em] text-canvas uppercase shadow-lg shadow-black/40 sm:px-2.5 sm:text-[11px]">
              {event.subType}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-black text-[10px] tracking-widest uppercase shadow-lg shadow-black/40 sm:px-3 sm:text-[11px]",
              paid ? "bg-gold text-on-gold" : "border border-gold/60 bg-canvas/85 text-gold backdrop-blur-sm"
            )}
          >
            {event.isFullyBooked ? "Sold out" : paid ? formatGBP(event.price ?? 0) : "Free entry"}
          </span>
        </div>
        {/* Sized from the text itself so nothing is ever cut off: the column
            width divided by (characters × ~0.72em, the average Archivo Black
            cap width at tracking-tighter). The longest word must fit one line;
            the whole title must fit in about two and a half lines. Words wrap
            one per line rather than truncating. */}
        <h1
          key={event.id}
          className="animate-reveal ad-extrude m-0 font-black leading-[0.85] tracking-tighter text-balance text-ink uppercase text-[clamp(1.5rem,min(calc((100vw-2rem)/(var(--title-chars)*0.72)),calc((100vw-2rem)*2.5/(var(--title-total)*0.72))),4.75rem)] md:text-[clamp(2.5rem,min(calc(min(50vw,44rem)/(var(--title-chars)*0.72)),calc(min(50vw,44rem)*2.5/(var(--title-total)*0.72))),6rem)]"
        >
          {event.title}
        </h1>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_14px_rgba(0,0,0,0.6)] sm:gap-x-3.5">
          <span className="text-[15px] font-bold text-ink tabular-nums sm:text-xl">
            {isTonight ? timeLabel : [format(dateObj, "EEEE"), timeLabel].filter(Boolean).join(" · ")}
          </span>
          <span className={cn("text-xs sm:text-sm", light ? "text-ink" : "text-ink-2")}>
            {[acts > 1 && active === 0 ? "Headline" : null, event.tagline, entryText(event)].filter(Boolean).join(" · ")}
          </span>
        </p>
        <div className="mt-1 flex items-stretch gap-2.5 [&_a]:h-12 [&_a]:w-auto [&_a]:flex-1 [&_a]:px-5 [&_a]:text-[13px] [&_span]:h-12 [&_span]:w-auto [&_span]:flex-1 [&_span]:px-4 sm:gap-3 md:[&_a]:h-14 md:[&_a]:flex-none md:[&_a]:px-8 md:[&_span]:h-14 md:[&_span]:flex-none md:[&_span]:px-7">
          <BookingButton event={event} />
          <EventActions event={event} className="[&_button]:h-12 [&_button]:w-12 [&_button]:rounded-xl [&_button]:border-white/15 [&_button]:text-ink md:[&_button]:h-14 md:[&_button]:w-14 md:[&_button]:rounded-[14px]" />
        </div>
      </div>

      {/* Desktop cards in the right-hand column */}
      <MarketHeroCard className="absolute top-22 right-6 lg:right-10" />
      {acts > 1 && (
        <div className="absolute right-6 bottom-16 hidden w-85 overflow-hidden rounded-2xl border border-ink/18 bg-canvas/80 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:block lg:right-10">
          <div className="flex items-center justify-between border-b border-ink/10 px-4.5 pt-3.5 pb-2.5">
            <span className="font-black text-[10px] tracking-[0.24em] text-gold uppercase">
              {isTonight ? "Tonight's bill" : `${format(dateObj, "EEEE")}'s bill`}
            </span>
            <span className="text-[11px] text-ink-2">{acts} acts · one entry</span>
          </div>
          <ol className="m-0 list-none p-0">
            {nightEvents.map((e, i) => {
              const on = i === active;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-3.5 border-l-[3px] px-4.5 py-3 text-left transition-colors",
                      on ? "border-gold bg-gold/8" : "border-transparent hover:bg-white/5"
                    )}
                  >
                    <span className={cn("w-13 shrink-0 font-black text-sm tabular-nums", on ? "text-ink" : "text-ink-2")}>
                      {e.startTimeLabel?.replace(/[ap]m$/, "") ?? "-"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-base leading-none tracking-tight text-ink uppercase">{e.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-ink-2">
                        {[i === 0 ? "Headline" : "Support", e.subType].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {on ? (
                      <span className="rounded-full bg-gold px-2 py-1 font-black text-[8px] tracking-[0.18em] text-on-gold uppercase">Showing</span>
                    ) : (
                      <span className="text-ink-2" aria-hidden="true">›</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="flex items-center gap-3 border-t border-ink/10 px-4.5 pt-2.5 pb-3.5 text-[11px] text-ink-2">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {[doors ? `Doors ${doors}` : null, entryText(nightEvents[0])].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      {/* Phone scroll cue */}
      {moreNights > 0 && (
        <Link
          href="#coming-up"
          className="absolute right-4 bottom-3.5 left-4 flex items-center justify-center gap-2 md:hidden"
        >
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-ink/25" aria-hidden="true" />
          <span className="inline-flex items-center gap-2 font-black text-[9px] tracking-[0.2em] text-gold uppercase">
            {moreNights === 1 ? "1 more night this week" : `${moreNights} more nights this week`}
            <ArrowDown className="ad-nudge h-3 w-3" aria-hidden="true" />
          </span>
          <span className="h-px flex-1 bg-linear-to-l from-transparent to-ink/25" aria-hidden="true" />
        </Link>
      )}
      </div>
    </section>
  );
}

/* Samples the lower-left of the poster (where the copy sits) and reports
   whether it is bright enough to need a heavier scrim. Fails closed. */
function useLightBackdrop(src: string | null) {
  const [sampled, setSampled] = useState<{ src: string; light: boolean } | null>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 32;
        const h = 32;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, img.height * 0.45, img.width * 0.65, img.height * 0.55, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        setSampled({ src, light: sum / (data.length / 4) / 255 > 0.5 });
      } catch {
        /* cross-origin image without CORS: keep the default scrim */
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return sampled?.src === src && sampled.light;
}
