import Image from "next/image";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  Mic2,
  Music,
  Ticket,
  Star,
  Disc3,
  PartyPopper,
} from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { EventCta } from "@/components/editorial/event-cta";
import { parseDate, type SerializedEvent } from "@/lib/events-display";


function eventIcon(event: SerializedEvent, className: string) {
  const key = (event.subType ?? "").toLowerCase();
  if (key.includes("karaoke")) return <Mic2 className={className} />;
  if (key.includes("quiz")) return <Star className={className} />;
  if (key.includes("bingo") || key.includes("gig"))
    return <Ticket className={className} />;
  if (key.includes("dj")) return <Disc3 className={className} />;
  if (key.includes("band")) return <Music className={className} />;
  if (key.includes("birthday") || key.includes("private"))
    return <PartyPopper className={className} />;
  return event.isKaraoke ? (
    <Mic2 className={className} />
  ) : (
    <Music className={className} />
  );
}

export function HighlightedEvents({ events }: { events: SerializedEvent[] }) {
  return (
    <section id="whats-on" className="scroll-mt-24">
      <SectionHeading
        eyebrow="The schedule"
        title="What's On"
        action={{ href: "/whats-on", label: "Full schedule" }}
      />

      {events.length > 0 ? (
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
          {events.map((event, i) => (
            <ScheduleCard key={event.id} event={event} index={i} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/3 py-16 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-stone-700" aria-hidden="true" />
          <p className="font-black text-sm tracking-tight text-stone-500 uppercase">
            More Nights Soon
          </p>
          <p className="mt-1 text-xs text-stone-600">Check back for the next round</p>
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
      className="ad-card ad-rise flex w-70 shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-hairline bg-canvas-2 sm:w-76"
      style={{ "--ev-c": event.color, "--i": index } as React.CSSProperties}
    >
      <div className="ad-poster relative flex aspect-4/3 items-center justify-center border-b border-hairline">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 280px, 304px"
            className="object-cover"
          />
        ) : (
          <span className="ad-kind flex h-16 w-16 items-center justify-center rounded-2xl border" aria-hidden="true">
            {eventIcon(event, "w-7 h-7")}
          </span>
        )}

        <div className="absolute top-3 left-3 rounded-xl border border-hairline bg-canvas/80 px-2.5 py-1.5 text-center backdrop-blur-sm">
          <span className="block font-black text-[9px] tracking-widest text-stone-400 uppercase">
            {format(dateObj, "EEE")}
          </span>
          <span className="block font-black text-xl leading-none text-ink tabular-nums">
            {format(dateObj, "d")}
          </span>
          <span className="mt-0.5 block font-black text-[9px] tracking-widest text-stone-400 uppercase">
            {format(dateObj, "MMM")}
          </span>
        </div>

        {event.isFullyBooked && (
          <span className="absolute top-3 right-3 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase backdrop-blur-sm">
            Sold Out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3
            className="ev-text line-clamp-2 font-black text-lg leading-tight tracking-tight uppercase"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </h3>
          {(event.subType || event.tagline) && (
            <p className="mt-1 line-clamp-2 text-xs font-medium text-stone-400">
              {[event.subType, event.tagline].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <dl className="mt-auto space-y-1 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <Calendar className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
            <dd className="font-bold text-ink">{format(dateObj, "d MMMM, yyyy")}</dd>
          </div>
          {timeLabel && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Time</dt>
              <Clock className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
              <dd className="font-bold text-ink tabular-nums">{timeLabel}</dd>
            </div>
          )}
        </dl>

        <EventCta event={event} size="lg" />
      </div>
    </li>
  );
}
