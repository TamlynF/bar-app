import Image from "next/image";
import Link from "next/link";
import { format, getDay, startOfDay } from "date-fns";
import { ArrowRight, Clock } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { BookingButton } from "@/components/editorial/booking-button";
import { PosterCard } from "@/components/poster-card";
import { cn } from "@/lib/utils";
import { entryText, type SerializedEvent } from "@/lib/events-display";
import type { OpeningHours } from "@/lib/company-info";

/* The next three nights the bar is open, as columns. Each night holds every
   event on it - the headline event as a poster card, the rest as compact
   rows - and a regular night with nothing dated still stands, showing the
   opening time, so the section never looks empty. */

type Night = {
  key: string;
  label: string;
  date: Date;
  dateStr: string;
  events: SerializedEvent[];
};

/* The next three dates after tonight that have something on. Tonight lives
   in the hero; nights with nothing booked are skipped. */
const DOW_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextEventNights(today: Date, events: SerializedEvent[]) {
  const todayStr = format(startOfDay(today), "yyyy-MM-dd");
  const dates = Array.from(new Set(events.map((e) => e.date)))
    .filter((d) => d > todayStr)
    .sort();
  return dates.slice(0, 3).map((d) => new Date(`${d}T00:00:00`));
}

function formatClock(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

function relativeLabel(night: Night, today: Date) {
  const diff = Math.round((startOfDay(night.date).getTime() - startOfDay(today).getTime()) / 86_400_000);
  return diff === 1 ? "Tomorrow" : `In ${diff} days`;
}

export function WeekNights({
  events,
  today,
  openingHours,
}: {
  events: SerializedEvent[];
  today: Date;
  openingHours: OpeningHours | null;
}) {
  const nights: Night[] = nextEventNights(today, events).map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      key: dateStr,
      label: format(date, "EEEE"),
      date,
      dateStr,
      events: events.filter((e) => e.date === dateStr),
    };
  });

  const weekLabel =
    nights.length > 1
      ? `${format(nights[0].date, "d MMM")} – ${format(nights[nights.length - 1].date, "d MMM")}`
      : nights.length === 1
        ? format(nights[0].date, "EEEE d MMM")
        : "Nothing booked yet";

  return (
    <section
      id="whats-on"
      className="mx-auto w-full max-w-400 scroll-mt-24 px-4 sm:px-6 lg:px-10"
    >
      <SectionHeading
        eyebrow={`The schedule · ${weekLabel}`}
        title="Coming up"
        action={{ href: "/whats-on", label: "Full schedule" }}
        actionOnMobile={false}
      />

      {nights.length === 0 && (
        <p className="rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center text-sm text-ink-2">
          Nothing booked after tonight yet - check the full schedule or follow us for announcements.
        </p>
      )}

      <ol className="grid gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
        {nights.map((night, i) => (
          <li
            key={night.key}
            style={{ "--i": i } as React.CSSProperties}
            className="ad-rise flex min-w-0 flex-col"
          >
            <NightColumn
              night={night}
              today={today}
              isNext={i === 0}
              hours={openingHours?.[DOW_KEYS[getDay(night.date)]]}
            />
          </li>
        ))}
      </ol>

      {/* Phones: the "see more" action lands after the content it extends */}
      <Link
        href="/whats-on"
        className="group mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 font-black text-[11px] tracking-[0.16em] text-ink uppercase transition-colors hover:border-gold/60 hover:text-gold sm:hidden"
      >
        See the full schedule
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

function NightColumn({
  night,
  today,
  hours,
  isNext,
}: {
  night: Night;
  today: Date;
  hours?: { open?: string | null; close?: string | null };
  /* First column - the very next night the bar opens - gets the gold treatment. */
  isNext: boolean;
}) {
  const [headline, ...rest] = night.events;
  const open = formatClock(hours?.open);
  const close = formatClock(hours?.close);

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-3xl border p-3 sm:p-4",
        isNext
          ? "border-gold/35 bg-gold/5 shadow-[0_0_60px_-28px_rgba(253,204,75,0.5)]"
          : "border-white/12 bg-white/4"
      )}
    >
      {/* Night header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-1 pt-1 pb-3">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "inline-block -rotate-2 rounded-lg px-3 py-2 font-black text-base leading-none tracking-[0.12em] uppercase shadow-lg shadow-black/40",
              isNext ? "bg-gold text-on-gold" : "bg-canvas-2 text-ink ring-1 ring-hairline"
            )}
          >
            {format(night.date, "EEE")}
          </span>
          <span className="font-black text-3xl leading-none tracking-tighter text-ink tabular-nums sm:text-4xl">
            {format(night.date, "d")}
          </span>
          <span className="font-black text-[11px] tracking-[0.2em] text-ink-2 uppercase">
            {format(night.date, "MMM")}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-black text-[9px] tracking-[0.2em] uppercase",
            isNext ? "bg-canvas text-gold" : "bg-white/6 text-ink-2"
          )}
        >
          {relativeLabel(night, today)}
        </span>
      </header>

      {/* Body */}
      {headline ? (
        <>
          {/* Phone: one split row per event (thumbnail left, facts right) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {night.events.map((event) => (
              <SplitRow key={event.id} event={event} />
            ))}
          </ul>
          {/* Tablet/desktop: poster for the headline act, rows for the rest */}
          <div className="hidden flex-col gap-3 md:flex">
            <PosterCard
              event={headline}
              isTonight={false}
              priority={false}
              className="aspect-4/3 sm:aspect-4/3 rounded-2xl ring-hairline shadow-none"
            />
            {rest.length > 0 && (
              <ul className="flex flex-col gap-2">
                {rest.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center">
          <p className="font-black text-sm tracking-tight text-ink uppercase">
            Open {night.label} night
          </p>
          <p className="inline-flex items-center justify-center gap-1.5 text-xs text-ink-2 tabular-nums">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {open ? `Doors ${open}${close ? ` · till ${close}` : ""}` : "Walk in · no booking needed"}
          </p>
        </div>
      )}

      {/* Opening line under a night that has events */}
      {headline && open && (
        <p className="px-1 pb-1 text-[11px] text-ink-2 tabular-nums">
          Doors {open}
          {close ? ` · till ${close}` : ""}
        </p>
      )}
    </div>
  );
}

function SplitRow({ event }: { event: SerializedEvent }) {
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  return (
    <li
      className="flex gap-3 rounded-2xl border border-hairline bg-canvas-2/80 p-2"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      <Link
        href={`/whats-on/${event.id}`}
        aria-label={`View details for ${event.title}`}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-canvas"
      >
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-(--ev-c)/45 to-canvas" aria-hidden="true" />
        )}
        {event.subType && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-(--ev-c) px-1.5 py-0.5 font-black text-[8px] tracking-[0.14em] text-canvas uppercase shadow-md shadow-black/40">
            {event.subType}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <Link href={`/whats-on/${event.id}`}>
            <p className="line-clamp-2 font-black text-[15px] leading-tight tracking-tight text-ink uppercase">
              {event.title}
            </p>
          </Link>
          <p className="mt-1 truncate text-[11px] font-bold text-ink-2 tabular-nums">
            {[timeLabel, entryText(event)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="mt-2.5 w-full [&_a]:h-10 [&_a]:rounded-lg [&_a]:text-[11px] [&_span]:h-10 [&_span]:rounded-lg [&_span]:text-[10px]">
          <BookingButton event={event} />
        </div>
      </div>
    </li>
  );
}

function EventRow({ event }: { event: SerializedEvent }) {
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;
  return (
    <li
      className="flex items-center gap-3 rounded-2xl border border-hairline bg-canvas-2/80 py-2.5 pr-2.5 pl-3.5"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-(--ev-c)" aria-hidden="true" />
      <Link href={`/whats-on/${event.id}`} className="min-w-0 flex-1">
        <p className="truncate font-black text-sm tracking-tight text-ink uppercase">{event.title}</p>
        <p className="truncate text-[11px] font-bold tracking-wide text-ink-2 uppercase tabular-nums">
          {[event.subType, timeLabel].filter(Boolean).join(" · ")}
        </p>
      </Link>
      <div className="shrink-0 [&_a]:h-10 [&_a]:w-auto [&_a]:rounded-xl [&_a]:px-3.5 [&_a]:text-[11px] [&_span]:h-10 [&_span]:w-auto [&_span]:rounded-xl [&_span]:px-3 [&_span]:text-[10px]">
        <BookingButton event={event} />
      </div>
    </li>
  );
}
