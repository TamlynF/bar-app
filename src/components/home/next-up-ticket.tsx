import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, Music2 } from "lucide-react";
import { BookingButton } from "@/components/editorial/booking-button";
import { entryText, parseDate, ticketAvailability, type EventSpace, type SerializedEvent } from "@/lib/events-display";
import { countdownLabel, nightLabel } from "@/lib/home-schedule";
import { cn } from "@/lib/utils";

/* The next dated night on the stage, as a gig ticket: poster with a date
   stamp and tags, a perforated stub line, then the act, its facts and the
   booking control. Weekly nights never appear here - they have their own
   strip - so this is always a one-off. */
const imagePill =
  "rounded-md px-2 py-1.5 text-pill font-bold tracking-wide uppercase shadow-md shadow-black/55 ring-1 sm:rounded-none";

export function NextUpTicket({
  event,
  space,
  today,
  headingId,
  className,
}: {
  event: SerializedEvent;
  space?: EventSpace | null;
  today: Date;
  headingId: string;
  className?: string;
}) {
  const date = parseDate(event.date);
  const availability = ticketAvailability(event, space);
  const soldOut = availability?.status === "sold_out";
  const shown = soldOut ? { ...event, isFullyBooked: true } : event;
  const entry = entryText(shown);
  const paid = event.price != null && event.price > 0;
  const status =
    availability?.status === "sold_out"
      ? { label: "Sold out", tone: "text-[#FF6B5E]" }
      : availability?.status === "nearly"
        ? { label: "Nearly sold out", tone: "text-[#FFB020]" }
        : !paid
          ? { label: "Free entry", tone: "text-ink-2" }
          : null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2 sm:gap-2.5", className)}>
      <div className="flex items-baseline justify-between gap-3 sm:gap-1">
        <h2
          id={headingId}
          className="flex flex-wrap items-baseline gap-y-1 border-l-3 border-gold pl-2.25 sm:block sm:border-l-0 sm:pl-0 sm:font-black sm:font-semibold sm:text-eyebrow sm:tracking-normal sm:text-gold"
        >
          <span className="font-black text-xl leading-none tracking-[-0.02em] text-ink uppercase sm:hidden">
            {nightLabel(event.date, today)}
          </span>
          <span className="hidden sm:inline">Next up on the stage</span>
        </h2>
        <span className="hidden shrink-0 text-ink-2 sm:block sm:text-pill sm:font-bold sm:tracking-wide sm:uppercase">
          {countdownLabel(event.date, today)}
        </span>
      </div>

      <div className="relative flex min-h-64 flex-col justify-end overflow-hidden rounded-2xl bg-canvas-2 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85),0_8px_16px_-6px_rgba(0,0,0,0.6)] sm:block sm:min-h-0 sm:overflow-visible sm:rounded-none sm:border-2 sm:border-ink sm:shadow-none">
        <div className="absolute inset-0 bg-canvas sm:relative sm:inset-auto sm:aspect-4/3 sm:w-full lg:aspect-square">
          {event.imageUrl ? (
            <Image src={event.imageUrl} alt="" fill sizes="(min-width: 1024px) 420px, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center pb-28 text-ink-2 sm:pb-0">
              <Music2 className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <span
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-canvas from-15% via-canvas/75 via-50% to-transparent to-85% sm:hidden"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-linear-to-b from-canvas/70 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute top-3 left-3 flex w-16 flex-col items-center rounded-lg bg-gold py-1.5 text-on-gold shadow-md shadow-black/55 ring-1 ring-black/40 max-sm:ring-canvas/55 sm:rounded-none">
            <span className="text-pill font-bold tracking-wide uppercase">{format(date, "EEE")}</span>
            <span className="font-black text-3xl leading-none tracking-tighter">{format(date, "d")}</span>
            <span className="text-pill font-bold tracking-wide uppercase">{format(date, "MMM")}</span>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {event.subType && (
              <span className={cn(imagePill, "bg-[#7A1F1F] text-ink ring-black/40 max-sm:ring-ink/45")}>
                {event.subType}
              </span>
            )}
            <span
              className={cn(
                imagePill,
                soldOut ? "bg-[#FF6B5E] text-canvas ring-black/40" : "bg-ink text-canvas ring-black/40",
              )}
            >
              {entry}
            </span>
          </div>
        </div>

        <div className="relative hidden border-t-2 border-dashed border-ink sm:block" aria-hidden="true">
          <span className="absolute -top-2.75 -left-3 h-5 w-5 rounded-full border-r-2 border-ink bg-canvas" />
          <span className="absolute -top-2.75 -right-3 h-5 w-5 rounded-full border-l-2 border-ink bg-canvas" />
        </div>

        <div className="relative flex flex-col gap-3 p-4 pt-24 sm:gap-4 sm:pt-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-black text-h2 leading-none tracking-tight text-balance text-ink uppercase drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-h3 sm:leading-tight sm:drop-shadow-none">
              {event.title}
            </h3>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-ink/85 sm:text-ink-2">
              {event.startTimeLabel && (
                <li className="flex items-center gap-1.5 text-[15px] font-bold text-ink sm:text-meta sm:font-normal sm:text-ink-2">
                  <Clock className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
                  Doors {event.startTimeLabel}
                </li>
              )}
              {event.isBookable && status && (
                <li className={cn("text-[15px] font-bold sm:hidden", status.tone)}>{status.label}</li>
              )}
            </ul>
          </div>
          <div className="flex gap-2">
            {event.isBookable && (
              <div className={cn("min-w-0 flex-1", !paid && "max-sm:hidden")}>
                <BookingButton event={shown} />
              </div>
            )}
            <Link
              href={`/whats-on/${event.id}`}
              className={cn(
                "flex h-12 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-canvas/50 px-5 text-btn font-semibold text-ink backdrop-blur-sm transition-colors hover:bg-ink/10 sm:rounded-none sm:bg-transparent sm:backdrop-blur-none",
                !event.isBookable && "flex-1",
                event.isBookable && !paid && "max-sm:flex-1",
              )}
            >
              Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
