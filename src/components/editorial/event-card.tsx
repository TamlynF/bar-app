"use client";

import { useLayoutEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, CalendarDays, ExternalLink, Mic2, RefreshCw } from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok } from "react-icons/si";
import type { IconType } from "react-icons";
import { VideoFacade } from "@/components/video-facade";
import { parseDate, type BandInfo, type SerializedEvent } from "@/lib/events-display";

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
        className={base + " pointer-events-auto bg-neon text-ink hover:bg-neon/90"}
        aria-label="Request a song to sing on Singa"
      >
        <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        Sing
      </a>
    );
  }

  if (event.isKaraoke) {
    // Karaoke night with no request URL yet — inactive placeholder.
    return (
      <span
        className={base + " cursor-default border border-hairline bg-white/5 text-ink-2"}
        title="Karaoke night hasn't started yet"
      >
        <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        Soon
      </span>
    );
  }

  if (event.isBookable && event.bookingPageUrl) {
    return (
      <a
        href={event.bookingPageUrl}
        onClick={stop}
        className={base + " pointer-events-auto bg-gold text-on-gold hover:bg-gold/90"}
        aria-label={`Book ${event.title}`}
      >
        <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
        Book
      </a>
    );
  }

  return null;
}

// Brand fills mirror the admin band card's social scheme so the icons read the
// same everywhere: Instagram gradient, Facebook blue, YouTube red, TikTok black.
const SOCIAL_META: {
  key: keyof BandInfo["socialLinks"];
  Icon: IconType;
  label: string;
  className: string;
}[] = [
  {
    key: "instagram",
    Icon: SiInstagram,
    label: "Instagram",
    className: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white",
  },
  { key: "facebook", Icon: SiFacebook, label: "Facebook", className: "bg-[#1877F2] text-white" },
  { key: "youtube", Icon: SiYoutube, label: "YouTube", className: "bg-[#FF0000] text-white" },
  { key: "tiktok", Icon: SiTiktok, label: "TikTok", className: "bg-black text-white ring-1 ring-white/20" },
];

/** Back-face band block for music acts: social icons + video-thumbnail links.
 *  Every control opens in a new tab and stops the flip toggle from firing. */
function BandMedia({ band, title }: { band: BandInfo; title: string }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const socials = SOCIAL_META.map((s) => ({ ...s, url: band.socialLinks[s.key] })).filter(
    (s) => s.url
  );
  const videos = band.videos.filter((v) => v.url);

  if (socials.length === 0 && videos.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {socials.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {socials.map(({ key, url, Icon, label, className }) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              aria-label={`${title} on ${label}`}
              className={
                "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 " +
                className
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
          {videos.map((v, i) => (
            // Wrapper re-enables pointer events (the flip layer disables them) and
            // stops the facade's play click from reaching the flip toggle.
            <div key={i} className="pointer-events-auto min-w-0" onClick={stop}>
              <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
              <p
                title={v.description || undefined}
                className="mt-1.5 line-clamp-2 text-[11px] font-medium text-ink-2"
              >
                {v.description || `Video ${i + 1}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
    "ev-card absolute inset-x-0 top-0 rounded-2xl border border-hairline bg-canvas-2 backface-hidden";

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
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-gold"
      />

      <div
        className={
          "pointer-events-none relative z-10 h-full w-full transition-transform duration-500 transform-3d " +
          (open ? "transform-[rotateY(180deg)]" : "")
        }
      >
        {/* FRONT — compact horizontal row */}
        <div
          className={
            faceBase +
            " flex h-full items-center gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4" +
            (open ? " is-lit pointer-events-none" : "")
          }
        >
          {/* Date chip — tinted with the subtype colour (.ad-kind reads --ev-c) */}
          <div className="ad-kind flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border leading-none sm:h-14 sm:w-14">
            <span className="font-black text-[8px] tracking-widest uppercase sm:text-[9px]">
              {format(dateObj, "EEE")}
            </span>
            <span className="font-black text-lg tabular-nums sm:text-xl">
              {format(dateObj, "d")}
            </span>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 pr-6">
              <span
                className="ev-dot h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              />
              <span className="truncate font-black text-[9px] tracking-[0.2em] text-ink-2 uppercase">
                {subLabel}
              </span>
              {event.isFullyBooked && (
                <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 font-black text-[8px] tracking-widest text-red-400 uppercase">
                  Sold Out
                </span>
              )}
            </div>

            {/* Title — flex-none so an overflow/nowrap flex child can't collapse */}
            <h3
              className="ev-text mt-0.5 line-clamp-2 flex-none pr-6 font-black text-base leading-[1.05] tracking-tight uppercase sm:text-lg"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </h3>

            {(timeLabel || price) && (
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {timeLabel && (
                  <span className="flex items-center gap-1 truncate text-[11px] font-bold text-ink-2 tabular-nums">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {timeLabel}
                  </span>
                )}
                {price && (
                  <span className="shrink-0 font-black text-[11px] tracking-wide text-ink">
                    {price}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action button */}
          {!isPast && <FrontCta event={event} />}

          {/* Flip hint — top-right corner; icon-only on mobile */}
          <span className="pointer-events-none absolute top-2.5 right-2.5 inline-flex items-center gap-1 font-black text-[9px] tracking-widest text-ink-2/60 uppercase">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {/* <span className="hidden sm:inline">Info</span> */}
          </span>
        </div>

        {/* BACK — no buttons; entry/price shown as text */}
        <div
          ref={backRef}
          className={
            faceBase +
            " flex transform-[rotateY(180deg)] flex-col p-3 sm:p-4" +
            (open ? " is-lit" : " pointer-events-none")
          }
        >
          {/* Header — subtype in its own colour + a bold date, with the time and
              ticket/entry line moved up here so the essentials read at a glance
              the moment the card flips (they used to sit in a footer). */}
          <div className="mb-3 border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span
                className="ev-dot h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              />
              <span
                className="ev-text truncate font-black text-[11px] tracking-[0.28em] uppercase"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              >
                {subLabel}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-black text-sm tracking-tight text-ink uppercase">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-2" aria-hidden="true" />
                {format(dateObj, "EEE d MMM")}
              </span>
              {timeLabel && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-2 tabular-nums">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {timeLabel}
                </span>
              )}
              <span className="font-black text-[10px] tracking-widest text-ink-2 uppercase">
                {entryText(event)}
              </span>
            </div>
          </div>

          {event.externalLink ? (
            <a
              href={event.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ev-text pointer-events-auto mb-2 inline-flex flex-none items-start gap-1.5 font-black text-lg leading-[0.95] tracking-tight uppercase underline decoration-2 underline-offset-2"
              style={{ "--ev-c": event.color } as React.CSSProperties}
              aria-label={`Open ${event.title} in a new tab`}
            >
              <span className="line-clamp-2">{event.title}</span>
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <h3
              className="ev-text mb-2 flex-none font-black text-lg leading-[0.95] tracking-tight uppercase"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </h3>
          )}

          {event.tagline ? (
            <p className="text-xs leading-relaxed text-ink-2">{event.tagline}</p>
          ) : (
            !event.band && (
              <p className="text-xs leading-relaxed text-ink-2/70 italic">
                More details at the door.
              </p>
            )
          )}

          {event.behavior === "music_act" && event.band && (
            <BandMedia band={event.band} title={event.title} />
          )}
        </div>
      </div>
    </div>
  );
}
