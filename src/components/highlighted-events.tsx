import { format } from "date-fns";
import {
  Calendar,
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
        <ul className="flex flex-col gap-3">
          {events.map((event, i) => (
            <ScheduleRow key={event.id} event={event} index={i} />
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

function ScheduleRow({
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
      className="ad-row ad-rise flex items-center gap-3 rounded-3xl border border-hairline bg-canvas-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5"
      style={{ "--ev-c": event.color, "--i": index } as React.CSSProperties}
    >
      <div className="w-11 shrink-0 text-center">
        <span className="block font-black text-[9px] tracking-widest text-stone-400 uppercase">
          {format(dateObj, "EEE")}
        </span>
        <span className="mt-0.5 block font-black text-2xl leading-none text-ink tabular-nums">
          {format(dateObj, "d")}
        </span>
      </div>

      <div
        className="ad-kind hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:flex"
        aria-hidden="true"
      >
        {eventIcon(event, "w-5 h-5")}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="ev-text line-clamp-1 font-black text-lg leading-none tracking-tight uppercase sm:text-xl"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </h3>
          {event.isFullyBooked && (
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase">
              Sold Out
            </span>
          )}
        </div>
        {(event.subType || event.tagline) && (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-stone-400">
            {[event.subType, event.tagline].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {timeLabel && (
        <span className="hidden shrink-0 text-right text-sm font-bold text-ink tabular-nums sm:block">
          {timeLabel}
        </span>
      )}

      <EventCta event={event} />
    </li>
  );
}
