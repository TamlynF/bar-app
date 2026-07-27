import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { DateChip } from "@/components/editorial/date-chip";
import { EventCta } from "@/components/editorial/event-cta";
import { EventPoster, PosterChip } from "@/components/editorial/event-poster";
import { parseDate, priceLabel, type SerializedEvent } from "@/lib/events-display";

export function EventGridCard({
  event,
  isPast = false,
}: {
  event: SerializedEvent;
  isPast?: boolean;
}) {
  const dateObj = parseDate(event.date);
  const price = priceLabel(event);
  const soldOut = event.isFullyBooked;
  const detailsHref = `/whats-on/${event.id}`;
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  return (
    <li
      className="ad-card flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-2"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      <Link
        href={detailsHref}
        className="group flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
      >
        <EventPoster
          event={event}
          alt={event.title}
          grayscale={isPast}
          zoomOnHover
          aspect="aspect-4/3"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        >
          <PosterChip event={event} />

          {soldOut ? (
            <span className="absolute top-3 right-3 rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-1 font-black text-[10px] tracking-widest text-red-300 uppercase backdrop-blur-sm">
              Sold Out
            </span>
          ) : (
            price && (
              <span className="absolute top-3 right-3 rounded-full border border-gold/40 bg-canvas/80 px-2.5 py-1 font-black text-[10px] tracking-widest text-gold uppercase backdrop-blur-sm">
                {price}
              </span>
            )
          )}

          <DateChip date={dateObj} tone="gold" className="absolute bottom-3 left-3" />
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
      </Link>

      <div className="mt-auto flex items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        {isPast ? (
          <Link
            href={detailsHref}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-white/5 font-black text-xs tracking-widest text-ink-2 uppercase transition-colors hover:bg-white/10 hover:text-ink"
          >
            See details
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <EventCta event={event} size="lg" bookLabel="Book tickets" />
            </div>
            <Link
              href={detailsHref}
              aria-label={`View details for ${event.title}`}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-hairline text-ink-2 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-ink"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </li>
  );
}
