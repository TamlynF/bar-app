import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, Music2, Ticket } from "lucide-react";
import { BookingButton } from "@/components/editorial/booking-button";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";
import { countdownLabel } from "@/lib/home-schedule";
import { cn } from "@/lib/utils";

/* The next dated night on the stage, as a gig ticket: poster with a date
   stamp and tags, a perforated stub line, then the act, its facts and the
   booking control. Weekly nights never appear here - they have their own
   strip - so this is always a one-off. */
export function NextUpTicket({
  event,
  today,
  headingId,
  className,
}: {
  event: SerializedEvent;
  today: Date;
  headingId: string;
  className?: string;
}) {
  const date = parseDate(event.date);
  const entry = entryText(event);

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2
          id={headingId}
          className="font-black text-h2 tracking-tighter text-balance text-ink uppercase sm:font-semibold sm:text-eyebrow sm:tracking-normal sm:text-gold sm:normal-case"
        >
          Next up on the stage
        </h2>
        <span className="text-pill font-bold tracking-wide text-ink-2 uppercase">{countdownLabel(event.date, today)}</span>
      </div>

      <div className="border-2 border-ink bg-canvas-2">
        <div className="relative aspect-3/2 w-full bg-canvas sm:aspect-4/3 lg:aspect-square">
          {event.imageUrl ? (
            <Image src={event.imageUrl} alt="" fill sizes="(min-width: 1024px) 420px, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-2">
              <Music2 className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex w-16 flex-col items-center bg-gold py-1.5 text-on-gold">
            <span className="text-pill font-bold tracking-wide uppercase">{format(date, "EEE")}</span>
            <span className="font-black text-3xl leading-none tracking-tighter">{format(date, "d")}</span>
            <span className="text-pill font-bold tracking-wide uppercase">{format(date, "MMM")}</span>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {event.subType && (
              <span className="bg-ink px-2 py-1.5 text-pill font-bold tracking-wide text-canvas uppercase">{event.subType}</span>
            )}
            <span className="bg-[#7A1F1F] px-2 py-1.5 text-pill font-bold tracking-wide text-ink uppercase">{entry}</span>
          </div>
        </div>

        <div className="relative border-t-2 border-dashed border-ink" aria-hidden="true">
          <span className="absolute -top-2.75 -left-3 h-5 w-5 rounded-full border-r-2 border-ink bg-canvas" />
          <span className="absolute -top-2.75 -right-3 h-5 w-5 rounded-full border-l-2 border-ink bg-canvas" />
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-black text-h3 tracking-tight text-ink uppercase">{event.title}</h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-meta text-ink-2">
              {event.startTimeLabel && (
                <li className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Doors {event.startTimeLabel}
                </li>
              )}
              {event.isBookable && (
                <li className="flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                  {event.requiresSeating ? "Tables bookable" : "Tickets available"}
                </li>
              )}
            </ul>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <BookingButton event={event} />
            </div>
            <Link
              href={`/whats-on/${event.id}`}
              className="flex h-12 shrink-0 items-center justify-center border-2 border-ink px-5 text-btn font-semibold text-ink transition-colors hover:bg-ink/10"
            >
              Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
