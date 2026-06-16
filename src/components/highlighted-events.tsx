import { format } from "date-fns";
import Link from "next/link";
import { Clock, CalendarDays, ExternalLink, Mic2, ArrowRight, Calendar } from "lucide-react";
import { NextEventHero } from "@/components/next-event-hero";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

/**
 * Home-page highlights: the next few upcoming events. The lead card reuses
 * NextEventHero (with its "tonight"/sold-out/book/karaoke states); any further
 * highlights render as compact cards. A "See full schedule" link sends people
 * to /whats-on for the complete month.
 */
export function HighlightedEvents({
  events,
  todayStr,
}: {
  events: SerializedEvent[];
  todayStr: string;
}) {
  const lead = events[0] ?? null;
  const isTonight = lead?.date === todayStr;
  const siblings = lead
    ? events.filter((e) => e.date === lead.date && e.id !== lead.id)
    : [];
  const rest = lead ? events.filter((e) => e.date !== lead.date) : [];

  return (
    <section className="mb-2">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-xs font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
          What&apos;s On
        </span>
        <Link
          href="/whats-on"
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-white transition-colors"
        >
          See full schedule
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>

      {lead ? (
        <>
          <NextEventHero event={lead} isTonight={isTonight} siblings={siblings} />
          {rest.length > 0 && (
            <div className="space-y-2.5">
              {rest.map((ev) => (
                <CompactEventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-white/3 border border-white/5 rounded-2xl">
          <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" />
          <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
            No Events Scheduled Yet
          </p>
          <p className="text-stone-600 text-xs mt-1">Check back soon</p>
        </div>
      )}
    </section>
  );
}

function CompactEventCard({ event }: { event: SerializedEvent }) {
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  return (
    <div className="olive-bg border border-white/10 rounded-2xl px-4 py-3.5 flex items-center gap-3">
      {/* Date column */}
      <div className="shrink-0 w-10 text-center">
        <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest leading-tight">
          {format(dateObj, "EEE")}
        </p>
        <p className="text-base font-black tabular-nums leading-none text-white">
          {format(dateObj, "d")}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {event.subType && (
          <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest leading-tight mb-0.5">
            {event.subType}
          </p>
        )}
        {event.externalLink ? (
          <a
            href={event.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 min-w-0 max-w-full"
          >
            <p
              className="ev-text text-sm font-black leading-tight truncate underline underline-offset-2 pb-px"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.title}
            </p>
            <ExternalLink className="w-3 h-3 shrink-0 text-stone-500" aria-hidden="true" />
          </a>
        ) : (
          <p
            className="ev-text text-sm font-black leading-tight truncate"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </p>
        )}
        {timeLabel && (
          <p className="flex items-center gap-1 text-stone-400 text-[10px] font-bold tabular-nums mt-0.5">
            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
            {timeLabel}
          </p>
        )}
      </div>

      {/* Right-side status / CTA */}
      {event.isFullyBooked && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
          Sold Out
        </span>
      )}
      {!event.isFullyBooked && event.isKaraoke && event.karaokeRequestUrl && (
        <a
          href={event.karaokeRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white bg-[#FF6B35] px-2.5 py-1.5 rounded-full hover:bg-[#FF6B35]/90 active:scale-95 transition-all"
          aria-label="Request a song to sing on Singa"
        >
          <Mic2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Sing
        </a>
      )}
      {!event.isFullyBooked && !event.isKaraoke && event.isBookable && event.bookingPageUrl && (
        <a
          href={event.bookingPageUrl}
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#1a2008] bg-[#FDCC4B] px-2.5 py-1.5 rounded-full hover:bg-[#FDCC4B]/90 active:scale-95 transition-all"
          aria-label={`Book ${event.title}`}
        >
          <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
          Book
        </a>
      )}
    </div>
  );
}
