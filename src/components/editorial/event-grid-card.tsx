import Link from "next/link";
import { Clock } from "lucide-react";
import { DateChip } from "@/components/editorial/date-chip";
import { BookingButton } from "@/components/editorial/booking-button";
import {
  EventPoster,
  PosterChip,
  PosterHoverHint,
  PriceChip,
} from "@/components/editorial/event-poster";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

export function EventGridCard({
  event,
  isPast = false,
}: {
  event: SerializedEvent;
  isPast?: boolean;
}) {
  const dateObj = parseDate(event.date);
  const detailsHref = `/whats-on/${event.id}`;
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  return (
    <li
      className="ad-card group relative flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-2"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      <Link
        href={detailsHref}
        aria-label={`View details for ${event.title}`}
        className="absolute inset-0 z-10 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
      />

      <EventPoster
        event={event}
        alt={event.title}
        grayscale={isPast}
        zoomOnHover
        aspect="aspect-4/3"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      >
        <PosterChip event={event} />
        <PriceChip event={event} />
        <DateChip date={dateObj} tone="gold" className="absolute bottom-3 left-3" />
        <PosterHoverHint />
      </EventPoster>

      <div className="flex flex-col gap-1.5 px-4 pt-4 pb-3 sm:px-5">
        <h3 className="line-clamp-2 font-black text-lg leading-tight tracking-tight text-ink uppercase transition-colors group-hover:text-gold">
          {event.title}
        </h3>

        {timeLabel && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-400 tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {timeLabel}
          </span>
        )}
      </div>

      <div className="relative z-20 mt-auto px-4 pb-4 sm:px-5 sm:pb-5">
        {isPast ? (
          <span className="pointer-events-none flex h-12 w-full items-center justify-center rounded-xl border border-hairline bg-white/5 font-black text-xs tracking-widest text-ink-2 uppercase">
            Event ended
          </span>
        ) : (
          <BookingButton event={event} />
        )}
      </div>
    </li>
  );
}
