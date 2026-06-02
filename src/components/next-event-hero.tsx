import { format } from "date-fns";
import { Clock, ArrowRight } from "lucide-react";

/**
 * Hero card for the single next-upcoming event. Promoted out of the list so the
 * "what's on" screen leads with what's actually coming up next, per STYLE_GUIDE.md
 * ("the home page must show what's on this week above the fold").
 *
 * Rendered as a Server Component. The whole card is a link:
 *  - external_link  -> opens the ticket/booking page in a new tab
 *  - otherwise      -> /book (the in-house booking hub)
 *
 * Colour: the event's brightened type colour drives the dot + title. The neon
 * accent (#FF6B35) is reserved for the "tonight / next" framing, exactly as the
 * style guide allocates it for live/urgency.
 */

type HeroEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  externalLink: string | null;
  isFullyBooked: boolean;
  color: string;
  subType: string | null;
};

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

export function NextEventHero({
  event,
  isTonight,
}: {
  event: HeroEvent;
  isTonight: boolean;
}) {
  const dateObj = parseDate(event.date);
  const eyebrow = isTonight
    ? `Tonight · ${format(dateObj, "EEE d")}`
    : `Next up · ${format(dateObj, "EEE d MMM")}`;

  const href = event.externalLink ?? "/book";
  const isExternal = Boolean(event.externalLink);

  const card = (
    <div className="olive-bg border neon-border rounded-2xl p-4 neon-glow">
      <div className="flex flex-col gap-1.5">
        {event.subType && (
          <span className="text-stone-500 text-[10px] font-black uppercase tracking-widest">
            {event.subType}
          </span>
        )}

        <p
          className="ev-text text-xl font-black tracking-tight leading-tight truncate"
          style={{ "--ev-c": event.color } as React.CSSProperties}
        >
          {event.title}
        </p>

        {event.startTimeLabel && (
          <p className="flex items-center gap-1.5 text-stone-300 text-[13px] font-bold tabular-nums">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {event.startTimeLabel}
            {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}
          </p>
        )}
      </div>

      {/* CTA — only meaningful when the event is bookable */}
      {!event.isFullyBooked && (
        <div className="mt-4 w-full h-12 flex items-center justify-center gap-1.5 bg-[#FDCC4B] text-[#1a2008] text-xs font-black uppercase tracking-wide rounded-xl">
          {isExternal ? "Get Tickets" : "Book a Table"}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      )}

      {event.isFullyBooked && (
        <div className="mt-3.5 w-full text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 py-3 rounded-xl">
          Sold Out
        </div>
      )}
    </div>
  );

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="neon-text text-[10px] font-black uppercase tracking-[0.25em]">
          {eyebrow}
        </span>
        <div className="flex-1 h-px neon-bg-muted" />
      </div>

      {isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block active:scale-[0.99] transition-transform">
          {card}
        </a>
      ) : (
        // Internal link still uses <a>; swap for next/link in page if preferred.
        <a href={href} className="block active:scale-[0.99] transition-transform">
          {card}
        </a>
      )}
    </section>
  );
}