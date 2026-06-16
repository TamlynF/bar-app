import { format } from "date-fns";
import Image from "next/image";
import { Clock, CalendarDays, ExternalLink, Mic2 } from "lucide-react";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

/**
 * Large awwwards-style "card" for a single event. Events have no images, so
 * the visual is colour/type-led (the brightened subtype colour via `ev-text`),
 * with an optional gallery photo backdrop for variety. Hover lifts + zooms.
 * The status/CTA logic mirrors NextEventHero (Sold Out / Book / Sing).
 */
export function EventCard({
  event,
  backdropUrl,
}: {
  event: SerializedEvent;
  backdropUrl?: string | null;
}) {
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  return (
    <div className="group relative olive-bg border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl hover:shadow-black/30 flex flex-col min-h-44">
      {backdropUrl && (
        <>
          <Image
            src={backdropUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover opacity-25 group-hover:opacity-35 group-hover:scale-105 transition-all duration-500"
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#26300D] via-[#26300D]/85 to-[#26300D]/40" />
        </>
      )}

      <div className="relative z-10 flex flex-col h-full p-5">
        {/* Top row: subtype + status */}
        <div className="flex items-center justify-between gap-2 mb-4">
          {event.subType ? (
            <span className="text-stone-400 text-[9px] font-black uppercase tracking-[0.25em] truncate">
              {event.subType}
            </span>
          ) : (
            <span />
          )}
          {event.isFullyBooked && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              Sold Out
            </span>
          )}
        </div>

        {/* Date */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-white font-black tabular-nums leading-none text-4xl">
            {format(dateObj, "d")}
          </span>
          <span className="text-stone-400 text-xs font-black uppercase tracking-widest">
            {format(dateObj, "EEE MMM")}
          </span>
        </div>

        {/* Title */}
        {event.externalLink ? (
          <a
            href={event.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1 min-w-0"
          >
            <span
              className="ev-text font-black uppercase tracking-tight leading-[0.95] text-xl sm:text-2xl underline underline-offset-2 line-clamp-2"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-500 mt-1" aria-hidden="true" />
          </a>
        ) : (
          <span
            className="ev-text font-black uppercase tracking-tight leading-[0.95] text-xl sm:text-2xl line-clamp-2"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </span>
        )}

        {/* Footer: time + CTA */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          {timeLabel ? (
            <span className="flex items-center gap-1 text-stone-400 text-[11px] font-bold tabular-nums">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {timeLabel}
            </span>
          ) : (
            <span />
          )}

          {!event.isFullyBooked && event.isKaraoke && event.karaokeRequestUrl && (
            <a
              href={event.karaokeRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-white bg-[#FF6B35] px-3 py-1.5 rounded-full hover:bg-[#FF6B35]/90 active:scale-95 transition-all"
              aria-label="Request a song to sing on Singa"
            >
              <Mic2 className="w-3 h-3 shrink-0" aria-hidden="true" />
              Sing
            </a>
          )}
          {!event.isFullyBooked && !event.isKaraoke && event.isBookable && event.bookingPageUrl && (
            <a
              href={event.bookingPageUrl}
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#1a2008] bg-[#FDCC4B] px-3 py-1.5 rounded-full hover:bg-[#FDCC4B]/90 active:scale-95 transition-all"
              aria-label={`Book ${event.title}`}
            >
              <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
              Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
