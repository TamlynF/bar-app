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

/**
 * Home-page "What's On" — the After Dark schedule: a vertical list of nights
 * that light up to the event's own colour on hover, each with a date chip, a
 * type icon, the title (+ Sold Out flag) and the shared booking CTA.
 *
 * The soonest event is featured in the hero, so this list shows the rest.
 */

/** A sign-like icon element for an event, picked from its subtype/behaviour. */
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
        <ul className="flex flex-col gap-2.5">
          {events.map((event, i) => (
            <ScheduleRow key={event.id} event={event} index={i} />
          ))}
        </ul>
      ) : (
        <div className="text-center py-16 bg-white/3 border border-white/5 rounded-2xl">
          <Calendar className="w-8 h-8 text-stone-700 mx-auto mb-3" aria-hidden="true" />
          <p className="text-stone-500 font-black text-sm uppercase tracking-tight">
            More Nights Soon
          </p>
          <p className="text-stone-600 text-xs mt-1">Check back for the next round</p>
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
      className="ad-row ad-rise flex items-center gap-3 sm:gap-4 rounded-2xl border border-hairline bg-[#26300D] px-4 py-3.5"
      style={{ "--ev-c": event.color, "--i": index } as React.CSSProperties}
    >
      {/* Date */}
      <div className="shrink-0 w-11 text-center">
        <span className="block text-stone-400 text-[9px] font-black uppercase tracking-widest">
          {format(dateObj, "EEE")}
        </span>
        <span className="block text-ink text-2xl font-black tabular-nums leading-none mt-0.5">
          {format(dateObj, "d")}
        </span>
      </div>

      {/* Type icon */}
      <div
        className="ad-kind hidden sm:flex shrink-0 w-11 h-11 rounded-xl items-center justify-center border"
        aria-hidden="true"
      >
        {eventIcon(event, "w-5 h-5")}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="ev-text font-black uppercase tracking-tight leading-none text-lg sm:text-xl line-clamp-1"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </h3>
          {event.isFullyBooked && (
            <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              Sold Out
            </span>
          )}
        </div>
        {(event.subType || event.tagline) && (
          <p className="text-stone-400 text-xs font-medium mt-1 line-clamp-1">
            {[event.subType, event.tagline].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Time */}
      {timeLabel && (
        <span className="hidden sm:block shrink-0 text-right text-ink text-sm font-bold tabular-nums">
          {timeLabel}
        </span>
      )}

      {/* CTA */}
      <EventCta event={event} />
    </li>
  );
}
