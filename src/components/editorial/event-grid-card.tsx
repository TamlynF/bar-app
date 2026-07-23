import Link from "next/link";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { EventPoster, PosterChip } from "@/components/editorial/event-poster";
import { parseDate, priceLabel, type SerializedEvent } from "@/lib/events-display";

function ctaLabel(event: SerializedEvent): string {
  if (event.isFullyBooked) return "Sold out!";
  if (event.isKaraoke) return event.karaokeRequestUrl ? "Sing tonight" : "More info";
  if (event.isBookable && event.bookingPageUrl) return "Book Tickets Now";
  if (event.externalLink) return "Get Tickets";
  return "More info";
}

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

  return (
    <li
      className="ad-card flex flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-2"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      <Link
        href={`/whats-on/${event.id}`}
        className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <EventPoster
          event={event}
          alt={event.title}
          grayscale={isPast}
          zoomOnHover
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        >
          <PosterChip event={event} />

          {soldOut && (
            <span className="absolute top-3 right-3 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase backdrop-blur-sm">
              Sold Out
            </span>
          )}

          {!soldOut && price && (
            <span className="absolute top-3 right-3 rounded-full bg-gold px-2.5 py-1 font-black text-[10px] tracking-widest text-on-gold uppercase">
              {price}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-5">
            <h3 className="line-clamp-2 font-black text-lg leading-tight tracking-tight text-ink uppercase">
              {event.title}
            </h3>

            <dl className="space-y-1 text-xs text-stone-300">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Date</dt>
                <dd className="font-bold">{format(dateObj, "d MMMM, yyyy")}</dd>
              </div>
              {event.startTimeLabel && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Time</dt>
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <dd className="font-bold tabular-nums">
                    {event.startTimeLabel}
                    {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </EventPoster>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <span
            className={
              "mt-auto inline-flex h-11 w-full items-center justify-center rounded-xl font-black text-xs tracking-widest uppercase transition-colors " +
              (soldOut || isPast
                ? "border border-white/10 bg-white/5 text-stone-400"
                : "bg-gold text-on-gold group-hover:bg-gold/90")
            }
          >
            {isPast ? "See details" : ctaLabel(event)}
          </span>
        </div>
      </Link>
    </li>
  );
}
