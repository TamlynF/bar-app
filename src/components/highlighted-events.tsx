import Link from "next/link";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { BookingButton } from "@/components/editorial/booking-button";
import {
  EventPoster,
  PosterHoverHint,
  PriceChip,
} from "@/components/editorial/event-poster";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

const HOMEPAGE_EVENT_LIMIT = 8;

export function HighlightedEvents({
  events,
}: {
  events: SerializedEvent[];
}) {
  const visibleEvents = events.slice(0, HOMEPAGE_EVENT_LIMIT);

  return (
    <section
      id="whats-on"
      className="mx-auto w-full max-w-400 scroll-mt-24 px-4 sm:px-6 lg:px-10"
    >
      <SectionHeading
        eyebrow="The schedule"
        title="What's on this week"
        action={{
          href: "/whats-on",
          label: events.length > HOMEPAGE_EVENT_LIMIT
            ? `View all ${events.length} events`
            : "Full schedule",
        }}
      />

      {visibleEvents.length > 0 ? (
        <ul
          className="
            no-scrollbar -mx-4 flex snap-x snap-mandatory
            scroll-px-4 items-stretch gap-3.5 overflow-x-auto
            px-4 pb-3

            sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2
            sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0

            lg:grid-cols-3 lg:gap-5

            xl:grid-cols-4 xl:gap-6
          "
        >
          {visibleEvents.map((event, index) => (
            <ScheduleCard
              key={event.id}
              event={event}
              index={index}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/3 py-16 text-center">
          <Calendar
            className="mx-auto mb-3 h-8 w-8 text-stone-700"
            aria-hidden="true"
          />

          <p className="font-black text-sm tracking-tight text-stone-500 uppercase">
            Nothing Else This Week
          </p>

          <p className="mt-1 text-xs text-stone-600">
            See the full schedule for what&apos;s next
          </p>
        </div>
      )}
    </section>
  );
}

function ScheduleCard({
  event,
  index,
}: {
  event: SerializedEvent;
  index: number;
}) {
  const dateLabel = format(parseDate(event.date), "EEE d MMM");

  const whenLabel = event.startTimeLabel
    ? `${dateLabel} · ${event.startTimeLabel}`
    : dateLabel;

  const detailsHref = `/whats-on/${event.id}`;

  return (
    <li
      className="
        ad-card ad-rise group relative flex
        w-[min(86vw,340px)] shrink-0 snap-start flex-col
        overflow-hidden rounded-2xl border border-hairline
        bg-canvas-2

        sm:w-auto sm:min-w-0 sm:shrink sm:snap-none
      "
      style={
        {
          "--ev-c": event.color,
          "--i": index,
        } as React.CSSProperties
      }
    >
      <Link
        href={detailsHref}
        aria-label={`View details for ${event.title}`}
        className="
          absolute inset-0 z-10 rounded-2xl outline-none
          focus-visible:ring-2 focus-visible:ring-gold
          focus-visible:ring-inset
        "
      />

      <EventPoster
        event={event}
        aspect="aspect-auto"
        className="
          h-47.5 shrink-0
          sm:h-50
          lg:h-46.25
          xl:h-47.5
        "
        zoomOnHover
        sizes="
          (max-width: 640px) 340px,
          (max-width: 1024px) 50vw,
          (max-width: 1280px) 33vw,
          25vw
        "
      >
        <PriceChip event={event} />
        <PosterHoverHint />
      </EventPoster>

      <div className="flex flex-col gap-1.5 px-4 pt-4 pb-3">
        {event.subType && (
          <span className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-widest text-(--ev-c) uppercase">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--ev-c)"
              aria-hidden="true"
            />
            {event.subType}
          </span>
        )}

        <h3 className="line-clamp-2 font-black text-xl leading-tight tracking-tight text-ink uppercase transition-colors group-hover:text-gold">
          {event.title}
        </h3>

        <span className="block font-black text-xs tracking-widest text-stone-400 uppercase tabular-nums">
          {whenLabel}
        </span>
      </div>

      <div className="relative z-20 mt-auto px-4 pb-4">
        <BookingButton event={event} />
      </div>
    </li>
  );
}
