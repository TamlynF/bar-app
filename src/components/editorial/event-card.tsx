"use client";

import { useLayoutEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, CalendarDays, ExternalLink, Mic2, RefreshCw } from "lucide-react";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

/**
 * Single-open flip card for the /whats-on schedule. Laid out as a compact,
 * fixed-height horizontal row: tinted date chip → content (subtype / title /
 * time + price) → action button, with a small flip "Info" hint pinned to the
 * top-right corner (icon-only on mobile). All closed cards share the same
 * height so the list reads as a neat stack; tapping flips the card (3D rotateY)
 * to a back face with the blurb + a meta line, and the card auto-grows to fit.
 *
 * "Single open" is owned by the parent (`open` + `onToggle`). Status/CTA logic
 * mirrors EventCta / NextEventHero so every surface agrees.
 */

/** Format a GBP amount: whole pounds as "£10", pennies as "£12.50". */
function formatGBP(n: number): string {
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/** Short entry/price token shown next to the time (from events.payment_amount). */
function priceLabel(event: SerializedEvent): string | null {
  if (event.isFullyBooked || event.price == null) return null;
  return event.price > 0 ? formatGBP(event.price) : "FREE";
}

/** The entry/price line shown as text on the back (the back has no buttons). */
function entryText(event: SerializedEvent): string {
  if (event.isFullyBooked) return "Sold out";
  if (event.price != null && event.price > 0) return `${formatGBP(event.price)} entry`;
  if (event.isKaraoke)
    return event.karaokeRequestUrl ? "Karaoke · requests open" : "Karaoke night";
  if (event.externalLink) return "Tickets via link";
  return "Free entry · walk in";
}

/** Front-face action button. `stopPropagation` so it doesn't flip the card. */
function FrontCta({ event }: { event: SerializedEvent }) {
  const base =
    "shrink-0 inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-3.5 py-2 rounded-full active:scale-95 transition-all";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (event.isFullyBooked) return null;

  if (event.isKaraoke && event.karaokeRequestUrl) {
    return (
      <a
        href={event.karaokeRequestUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        className={base + " pointer-events-auto text-ink bg-neon hover:bg-neon/90"}
        aria-label="Request a song to sing on Singa"
      >
        <Mic2 className="w-3 h-3 shrink-0" aria-hidden="true" />
        Sing
      </a>
    );
  }

  if (event.isKaraoke) {
    // Karaoke night with no request URL yet — inactive placeholder.
    return (
      <span
        className={base + " bg-white/5 text-ink-2 border border-hairline cursor-default"}
        title="Karaoke night hasn't started yet"
      >
        <Mic2 className="w-3 h-3 shrink-0" aria-hidden="true" />
        Soon
      </span>
    );
  }

  if (event.isBookable && event.bookingPageUrl) {
    return (
      <a
        href={event.bookingPageUrl}
        onClick={stop}
        className={base + " pointer-events-auto text-on-gold bg-gold hover:bg-gold/90"}
        aria-label={`Book ${event.title}`}
      >
        <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
        Book
      </a>
    );
  }

  return null;
}

export function EventCard({
  event,
  open,
  onToggle,
  isPast = false,
  isNext = false,
}: {
  event: SerializedEvent;
  open: boolean;
  onToggle: () => void;
  isPast?: boolean;
  isNext?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Closed cards share a fixed height (set in the className). When opened, pin
  // the container to the back face's height (via --fh) so it grows to fit it.
  useLayoutEffect(() => {
    const c = containerRef.current;
    const b = backRef.current;
    if (!c || !b) return;
    const apply = () => {
      if (open) c.style.setProperty("--fh", `${b.scrollHeight}px`);
      else c.style.removeProperty("--fh");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [open, event]);

  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  const subLabel = event.subType ?? "Event";
  const price = priceLabel(event);
  const faceBase =
    "absolute inset-x-0 top-0 rounded-2xl border border-hairline bg-canvas-2 backface-hidden";

  return (
    <div
      ref={containerRef}
      style={{ "--ev-c": event.color } as React.CSSProperties}
      className={
        "group relative block w-full rounded-2xl transition-[height] duration-450 ease-out perspective-distant " +
        (open ? "h-(--fh) " : "h-26 sm:h-28 ") +
        (isNext ? "ring-2 ring-neon" : "")
      }
    >
      {/* Flip toggle — covers the card and sits behind the faces, so the links
          and buttons layered above it stay clickable without nesting one
          interactive control inside another. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${event.title} — show details`}
        className="absolute inset-0 z-0 rounded-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gold"
      />

      <div
        className={
          "pointer-events-none relative z-10 h-full w-full transform-3d transition-transform duration-500 " +
          (open ? "transform-[rotateY(180deg)]" : "")
        }
      >
        {/* FRONT — compact horizontal row */}
        <div
          className={
            faceBase +
            " flex items-center gap-3 p-3 h-full overflow-hidden sm:gap-4 sm:p-4" +
            (open ? " pointer-events-none" : "")
          }
        >
          {/* Date chip — tinted with the subtype colour (.ad-kind reads --ev-c) */}
          <div className="ad-kind shrink-0 flex flex-col items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-xl border leading-none">
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
              {format(dateObj, "EEE")}
            </span>
            <span className="text-lg sm:text-xl font-black tabular-nums">
              {format(dateObj, "d")}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 pr-6">
              <span
                className="ev-dot w-1.5 h-1.5 rounded-full shrink-0"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              />
              <span className="text-ink-2 text-[9px] font-black uppercase tracking-[0.2em] truncate">
                {subLabel}
              </span>
              {event.isFullyBooked && (
                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                  Sold Out
                </span>
              )}
            </div>

            {/* Title — flex-none so an overflow/nowrap flex child can't collapse */}
            <h3
              className="ev-text flex-none font-black uppercase tracking-tight leading-[1.05] text-base sm:text-lg line-clamp-2 mt-0.5 pr-6"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </h3>

            {(timeLabel || price) && (
              <div className="flex items-center gap-2 mt-1 min-w-0">
                {timeLabel && (
                  <span className="flex items-center gap-1 text-ink-2 text-[11px] font-bold tabular-nums truncate">
                    <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {timeLabel}
                  </span>
                )}
                {price && (
                  <span className="shrink-0 text-ink text-[11px] font-black tracking-wide">
                    {price}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action button */}
          {!isPast && <FrontCta event={event} />}

          {/* Flip hint — top-right corner; icon-only on mobile */}
          <span className="pointer-events-none absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-ink-2/60 text-[9px] font-black uppercase tracking-widest">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {/* <span className="hidden sm:inline">Info</span> */}
          </span>
        </div>

        {/* BACK — no buttons; entry/price shown as text */}
        <div
          ref={backRef}
          className={
            faceBase +
            " flex flex-col p-3 sm:p-4 transform-[rotateY(180deg)]" +
            (open ? "" : " pointer-events-none")
          }
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="ev-dot w-2 h-2 rounded-full shrink-0"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            />
            <span className="text-ink-2 text-[9px] font-black uppercase tracking-[0.25em] truncate">
              {subLabel} · {format(dateObj, "EEE d MMM")}
            </span>
          </div>

          {event.externalLink ? (
            <a
              href={event.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ev-text pointer-events-auto flex-none inline-flex items-start gap-1.5 font-black uppercase tracking-tight leading-[0.95] text-lg mb-2 underline underline-offset-2 decoration-2"
              style={{ "--ev-c": event.color } as React.CSSProperties}
              aria-label={`Open ${event.title} in a new tab`}
            >
              <span className="line-clamp-2">{event.title}</span>
              <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            </a>
          ) : (
            <h3
              className="ev-text flex-none font-black uppercase tracking-tight leading-[0.95] text-lg mb-2"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </h3>
          )}

          {event.tagline ? (
            <p className="text-ink-2 text-xs leading-relaxed line-clamp-3">{event.tagline}</p>
          ) : (
            <p className="text-ink-2/70 text-xs leading-relaxed italic">
              More details at the door.
            </p>
          )}

          <div className="mt-auto pt-3 border-t border-hairline">
            <span className="text-ink-2 text-[10px] font-bold uppercase tracking-widest">
              {[timeLabel, entryText(event)].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
