import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { DateChip } from "@/components/editorial/date-chip";
import { BookingButton } from "@/components/editorial/booking-button";
import {
  EventPoster,
  PosterHoverHint,
  PriceChip,
} from "@/components/editorial/event-poster";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

export function HighlightedEvents({ events }: { events: SerializedEvent[] }) {
  return (
    <section id="whats-on" className="mx-auto w-full max-w-400 scroll-mt-24 px-4 sm:px-6 lg:px-10">
      <SectionHeading
        eyebrow="The schedule"
        title="Rest Of The Week"
        action={{ href: "/whats-on", label: "Full schedule" }}
      />

      {events.length > 0 ? (
        <div className="rail-scrollbar snap-x snap-mandatory scroll-px-4 overflow-x-auto pb-4">
          <ul className="mx-auto flex w-max max-w-full items-stretch gap-4">
            {events.map((event, i) => (
              <ScheduleCard key={event.id} event={event} index={i} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/3 py-16 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-stone-700" aria-hidden="true" />
          <p className="font-black text-sm tracking-tight text-stone-500 uppercase">
            Nothing Else This Week
          </p>
          <p className="mt-1 text-xs text-stone-600">See the full schedule for what&apos;s next</p>
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
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  const detailsHref = `/whats-on/${event.id}`;

  return (
    <li
      className="ad-card ad-rise group relative flex w-70 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas-2 sm:w-76 lg:w-80"
      style={{ "--ev-c": event.color, "--i": index } as React.CSSProperties}
    >
      <Link
        href={detailsHref}
        aria-label={`View details for ${event.title}`}
        className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
      />

      <EventPoster
        event={event}
        aspect="aspect-4/3"
        zoomOnHover
        sizes="(max-width: 640px) 280px, (max-width: 1024px) 304px, 320px"
      >
        <PriceChip event={event} />
        <DateChip date={dateObj} tone="dark" className="absolute top-3 left-3" />
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

      <div className="relative z-20 mt-auto px-4 pb-4">
        <BookingButton event={event} />
      </div>
    </li>
  );
}
