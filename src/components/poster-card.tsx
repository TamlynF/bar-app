import Image from "next/image";
import { format } from "date-fns";
import { BookingButton } from "@/components/editorial/booking-button";
import { PosterChip, PosterTint, PriceChip } from "@/components/editorial/event-poster";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";

const MAX_POSTER_TAGLINE = 60;

/* Full-bleed "gig poster" card for tonight's act: image fills the card, act
   name sits on the bottom gradient, time + booking CTA in the footer. Used on
   the home hero (single card, or stacked in TonightDeck when several events
   share a night). */
export function PosterCard({
  event,
  isTonight,
  className,
  priority = true,
}: {
  event: SerializedEvent;
  isTonight: boolean;
  className?: string;
  priority?: boolean;
}) {
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  const whenLabel = [isTonight ? "Tonight" : format(dateObj, "EEE d MMM"), timeLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "relative aspect-4/3 w-full overflow-hidden rounded-3xl bg-canvas-2 shadow-[0_30px_60px_rgba(0,0,0,0.55)] ring-1 ring-gold/25 sm:aspect-[4/4.4]",
        className
      )}
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover object-[center_30%]"
        />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-(--ev-c)/45 via-canvas-2 to-canvas" aria-hidden="true" />
      )}
      <PosterTint />
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-canvas/5 via-canvas/15 via-40% to-canvas/95"
        aria-hidden="true"
      />

      <PosterChip event={event} />
      <PriceChip event={event} treatUnpricedAsFree={!event.isBookable} />

      <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-6">
        {event.tagline && event.tagline.length <= MAX_POSTER_TAGLINE && (
          <p className="mb-2 truncate font-black text-[10px] tracking-[0.22em] text-gold uppercase">
            {event.tagline}
          </p>
        )}
        <h2 className="line-clamp-2 font-black text-[clamp(1.5rem,7vw,2.25rem)] leading-[0.9] tracking-tighter text-ink uppercase drop-shadow-[0_8px_0_rgba(0,0,0,0.35)] sm:line-clamp-3 sm:text-5xl md:text-3xl lg:text-4xl xl:text-5xl [overflow-wrap:anywhere]">
          {event.title}
        </h2>

        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/15 pt-2.5 sm:mt-4 sm:pt-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink tabular-nums sm:text-sm">{whenLabel}</p>
            <p className="truncate text-[11px] text-ink-2 sm:text-xs">{entryText(event)}</p>
          </div>
          <div className="w-34 shrink-0 [&_a]:h-11 [&_a]:text-xs [&_a]:whitespace-nowrap [&_span]:h-11 [&_span]:text-xs sm:w-40 sm:[&_a]:h-12 sm:[&_a]:text-sm sm:[&_span]:h-12 sm:[&_span]:text-sm">
            <BookingButton event={event} />
          </div>
        </div>
      </div>
    </article>
  );
}
