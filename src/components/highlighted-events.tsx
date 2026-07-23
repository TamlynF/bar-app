import { Calendar, Clock } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { DateChip } from "@/components/editorial/date-chip";
import { EventCta } from "@/components/editorial/event-cta";
import { EventPoster } from "@/components/editorial/event-poster";
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

  return (
    <li
      className="ad-card ad-rise relative w-70 shrink-0 snap-start overflow-hidden rounded-2xl border border-hairline bg-canvas-2 sm:w-76 lg:w-80"
      style={{ "--ev-c": event.color, "--i": index } as React.CSSProperties}
    >
      <EventPoster
        event={event}
        sizes="(max-width: 640px) 280px, (max-width: 1024px) 304px, 320px"
      >
        <DateChip date={dateObj} className="absolute top-3 left-3" />

        {event.isFullyBooked && (
          <span className="absolute top-3 right-3 rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-300 uppercase backdrop-blur-sm">
            Sold Out
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
          {event.subType && (
            <span
              className="ev-text font-black text-[9px] tracking-[0.25em] uppercase"
              style={{ "--ev-c": event.color } as React.CSSProperties}
            >
              {event.subType}
            </span>
          )}

          <h3 className="line-clamp-2 font-black text-lg leading-tight tracking-tight text-ink uppercase">
            {event.title}
          </h3>

          {timeLabel && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-300 tabular-nums">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {timeLabel}
            </span>
          )}

          <div className="mt-1">
            <EventCta event={event} size="lg" />
          </div>
        </div>
      </EventPoster>
    </li>
  );
}
