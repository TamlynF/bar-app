import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, Music2 } from "lucide-react";
import { BookingButton } from "@/components/editorial/booking-button";
import { DoorsPill } from "@/components/home/doors-pill";
import {
  entryText,
  parseDate,
  priceLabel,
  ticketAvailability,
  type EventSpace,
  type SerializedEvent,
} from "@/lib/events-display";
import { countdownLabel, nightLabel } from "@/lib/home-schedule";
import { cn } from "@/lib/utils";

/* The next dated night on the stage, as a gig ticket: poster with a date
   stamp and tags, a perforated stub line, then the act, its facts and the
   booking control. Weekly nights never appear here - they have their own
   strip - so this is always a one-off. On phones the poster hangs between
   two red curtains under a scalloped valance, like the stage itself. */
const imagePill =
  "rounded-md px-2 py-1.5 text-pill font-bold tracking-wide uppercase shadow-md shadow-black/55 ring-1 sm:rounded-none";

const curtain = "ad-curtain pointer-events-none absolute inset-y-0 z-10 w-11 sm:hidden";

const MOBILE_ACTION =
  "flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-3.5 text-xs leading-none font-extrabold tracking-[0.04em] uppercase";

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
  const status =
    availability?.status === "sold_out"
      ? { label: "Sold out", tone: "text-[#FF6B5E]" }
      : availability?.status === "nearly"
        ? { label: "Nearly sold out", tone: "text-[#FFB020]" }
        : null;
  const stamp = event.isBookable ? status : null;
  const price = soldOut ? null : priceLabel(shown);
  const pricePill = soldOut || event.isFullyBooked ? "Sold out" : price === "FREE" ? "Free" : price;
  const ticketHref = soldOut || event.isFullyBooked ? null : event.isBookable ? event.bookingPageUrl : event.externalLink;
  const ticketExternal = !event.isBookable && Boolean(event.externalLink);

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3.5 sm:gap-2.5", className)}>
      <div className="flex items-end justify-between gap-3 sm:items-baseline sm:gap-1">
        <h2 id={headingId} className="min-w-0 sm:font-semibold sm:text-eyebrow sm:text-gold">
          <span className="mb-1.5 block text-[10px] leading-none font-bold tracking-[0.18em] text-gold uppercase sm:hidden">
            Next up on stage
          </span>
          <span className="block font-display text-[26px] leading-none tracking-[0.02em] text-ink uppercase sm:hidden">
            {nightLabel(event.date, today)}
          </span>
          <span className="hidden sm:inline">Next up on Stage</span>
        </h2>
        <span className="ad-featured shrink-0 rounded-full border border-gold/45 bg-gold/10 px-2.25 py-1.75 text-[10px] leading-none font-extrabold tracking-[0.14em] text-gold uppercase sm:hidden">
          ★ Featured
        </span>
        <span className="hidden shrink-0 text-ink-2 sm:block sm:text-pill sm:font-bold sm:tracking-wide sm:uppercase">
          {countdownLabel(event.date, today)}
        </span>
      </div>

      <div className="relative flex flex-col justify-end overflow-hidden rounded-[20px] border border-gold/35 bg-canvas-2 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85),0_8px_16px_-6px_rgba(0,0,0,0.6)] max-sm:h-85 sm:block sm:overflow-visible sm:rounded-none sm:border-2 sm:border-ink sm:shadow-none">
        <div className="absolute inset-0 bg-canvas sm:relative sm:inset-auto sm:aspect-4/3 sm:w-full lg:aspect-square">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover max-sm:object-[center_30%]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center pb-28 text-ink-2 sm:pb-0">
              <Music2 className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <span
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black from-0% via-black/85 via-35% to-transparent to-70% sm:hidden"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-linear-to-b from-black/60 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute top-3 left-3 flex w-16 flex-col items-center rounded-lg bg-gold py-1.5 text-on-gold shadow-md shadow-black/55 ring-1 ring-black/40 max-sm:top-6 max-sm:left-4 max-sm:z-20 max-sm:w-auto max-sm:rounded-2xl max-sm:bg-[#171C0A]/90 max-sm:px-3.5 max-sm:py-2.5 max-sm:text-gold max-sm:shadow-[0_6px_16px_rgb(0_0_0/0.55)] max-sm:ring-2 max-sm:ring-gold max-sm:backdrop-blur-[6px] sm:rounded-none">
            <span className="text-pill font-bold tracking-wide uppercase max-sm:mb-1 max-sm:leading-none max-sm:font-extrabold max-sm:tracking-[0.14em]">
              {format(date, "EEE")}
            </span>
            <span className="font-black text-3xl leading-none tracking-tighter max-sm:font-display max-sm:text-4xl max-sm:tracking-normal">
              {format(date, "d")}
            </span>
            <span className="text-pill font-bold tracking-wide uppercase max-sm:mt-1 max-sm:leading-none max-sm:font-extrabold max-sm:tracking-[0.14em]">
              {format(date, "MMM")}
            </span>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5 max-sm:top-6 max-sm:right-4 max-sm:z-20">
            {event.subType && (
              <span
                className={cn(
                  imagePill,
                  "bg-(--ev-c) text-canvas ring-black/40 max-sm:bg-[#14305C] max-sm:px-2.5 max-sm:py-2 max-sm:text-xs max-sm:font-extrabold max-sm:text-ink max-sm:shadow-[0_4px_12px_rgb(0_0_0/0.6)] max-sm:ring-2 max-sm:ring-canvas/90"
                )}
                style={{ "--ev-c": event.color } as React.CSSProperties}
              >
                {event.subType}
              </span>
            )}
            {pricePill && (
              <span
                className={cn(
                  imagePill,
                  "px-2.5 py-2 text-xs font-extrabold shadow-[0_4px_12px_rgb(0_0_0/0.6)] ring-2 ring-canvas/90 sm:hidden",
                  soldOut || event.isFullyBooked ? "bg-[#FF6B5E] text-canvas" : "bg-white text-[#20231A]"
                )}
              >
                {pricePill}
              </span>
            )}
            <span
              className={cn(
                imagePill,
                "max-sm:hidden",
                soldOut ? "bg-[#FF6B5E] text-canvas ring-black/40" : "bg-ink text-canvas ring-black/40"
              )}
            >
              {entry}
            </span>
          </div>
        </div>

        <span className={cn(curtain, "left-0")} aria-hidden="true">
          <span className="ad-curtain-tassel" />
        </span>
        <span className={cn(curtain, "right-0 -scale-x-100")} aria-hidden="true">
          <span className="ad-curtain-tassel" />
        </span>
        <span
          className="ad-valance pointer-events-none absolute inset-x-0 top-0 z-20 h-3.5 border-b-2 border-gold sm:hidden"
          aria-hidden="true"
        />

        <div className="relative hidden border-t-2 border-dashed border-ink sm:block" aria-hidden="true">
          <span className="absolute -top-2.75 -left-3 h-5 w-5 rounded-full border-r-2 border-ink bg-canvas" />
          <span className="absolute -top-2.75 -right-3 h-5 w-5 rounded-full border-l-2 border-ink bg-canvas" />
        </div>

        <div className="relative z-20 flex flex-col gap-3 p-4 pt-24 sm:z-auto sm:gap-4 sm:pt-4">
          <div className="flex flex-col gap-2">
            {(event.startTimeLabel || stamp) && (
              <p className="flex sm:hidden">
                <DoorsPill imageUrl={event.imageUrl}>
                  {event.startTimeLabel && <span>Doors {event.startTimeLabel}</span>}
                  {event.startTimeLabel && stamp && (
                    <span className="size-0.75 rounded-full bg-current opacity-60" aria-hidden="true" />
                  )}
                  {stamp && <span className={stamp.tone}>{stamp.label}</span>}
                </DoorsPill>
              </p>
            )}
            <h3 className="font-black text-[28px] leading-[0.95] text-balance text-ink uppercase max-sm:px-7 [text-shadow:0_2px_4px_rgb(0_0_0/0.9),0_0_24px_rgb(0_0_0/0.7)] sm:text-h3 sm:leading-tight sm:[text-shadow:none]">
              {event.title}
            </h3>
            <ul className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-ink-2 sm:flex">
              {event.startTimeLabel && (
                <li className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Doors {event.startTimeLabel}
                </li>
              )}
            </ul>
          </div>
          <div className="flex gap-2">
            {event.isBookable && (
              <div className="min-w-0 flex-1 max-sm:hidden">
                <BookingButton event={shown} />
              </div>
            )}
            {ticketHref && (
              <a
                href={ticketHref}
                target={ticketExternal ? "_blank" : undefined}
                rel={ticketExternal ? "noopener noreferrer" : undefined}
                aria-label={`Tickets for ${event.title}`}
                className={cn(
                  MOBILE_ACTION,
                  "bg-gold text-on-gold shadow-[0_3px_0_#a8801c] hover:bg-[#ffd76a] active:translate-y-0.5 active:shadow-none sm:hidden"
                )}
              >
                Tickets
              </a>
            )}
            <Link
              href={`/whats-on/${event.id}`}
              className={cn(
                MOBILE_ACTION,
                "border-2 border-ink bg-canvas/50 text-ink backdrop-blur-[6px] transition-colors hover:bg-ink/10 sm:h-12 sm:flex-none sm:shrink-0 sm:rounded-none sm:bg-transparent sm:px-5 sm:text-btn sm:font-semibold sm:tracking-normal sm:normal-case sm:backdrop-blur-none",
                !event.isBookable && "sm:flex-1"
              )}
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
