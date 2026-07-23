import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  Clock,
  Mic2,
  Music,
  Ticket,
  Star,
  Disc3,
  PartyPopper,
} from "lucide-react";
import { parseDate, priceLabel, type SerializedEvent } from "@/lib/events-display";

function eventIcon(event: SerializedEvent, className: string) {
  const key = (event.subType ?? "").toLowerCase();
  if (key.includes("karaoke")) return <Mic2 className={className} />;
  if (key.includes("quiz")) return <Star className={className} />;
  if (key.includes("bingo") || key.includes("gig")) return <Ticket className={className} />;
  if (key.includes("dj")) return <Disc3 className={className} />;
  if (key.includes("band")) return <Music className={className} />;
  if (key.includes("birthday") || key.includes("private"))
    return <PartyPopper className={className} />;
  return event.isKaraoke ? <Mic2 className={className} /> : <Music className={className} />;
}

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
        <div className="ad-poster relative flex aspect-4/3 items-center justify-center border-b border-hairline">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={
                "object-cover transition-transform duration-500 group-hover:scale-105 " +
                (isPast ? "grayscale" : "")
              }
            />
          ) : (
            <span
              className="ad-kind flex h-16 w-16 items-center justify-center rounded-2xl border"
              aria-hidden="true"
            >
              {eventIcon(event, "w-7 h-7")}
            </span>
          )}

          {event.subType && (
            <span
              className="ev-text absolute top-3 left-3 rounded-full border border-hairline bg-canvas/80 px-2.5 py-1 font-black text-[9px] tracking-[0.2em] uppercase backdrop-blur-sm"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.subType}
            </span>
          )}

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
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <h3
            className="ev-text line-clamp-2 font-black text-lg leading-tight tracking-tight uppercase"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </h3>

          <dl className="space-y-1 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Date</dt>
              <dd className="font-bold text-ink">{format(dateObj, "d MMMM, yyyy")}</dd>
            </div>
            {event.startTimeLabel && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Time</dt>
                <Clock className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
                <dd className="font-bold text-ink tabular-nums">
                  {event.startTimeLabel}
                  {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}
                </dd>
              </div>
            )}
          </dl>

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
