import Image from "next/image";
import { format } from "date-fns";
import { BookingButton } from "@/components/editorial/booking-button";
import { PosterChip, PosterTint, PriceChip } from "@/components/editorial/event-poster";
import { cn } from "@/lib/utils";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

function OutlinedWord({ text, word }: { text: string; word?: string }) {
  const start = word ? text.toLowerCase().indexOf(word.toLowerCase()) : -1;
  if (start < 0 || !word) return <>{text}</>;

  return (
    <>
      {text.slice(0, start)}
      <span className="ad-word-outline">{text.slice(start, start + word.length)}</span>
      {text.slice(start + word.length)}
    </>
  );
}

export function HomeHero({
  tagline,
  accentWord,
  tonightEvents,
  isTonight,
}: {
  tagline: string | null;
  accentWord?: string;
  tonightEvents: SerializedEvent[];
  isTonight: boolean;
}) {
  return (
    <section className="relative pt-3 pb-4 text-center">
      <div className="relative z-10 flex flex-col items-center">
        {tagline && (
          <h1 className="animate-reveal m-0 max-w-3xl font-black text-[clamp(1.5rem,6.4vw,3rem)] leading-[0.92] tracking-tighter text-ink uppercase drop-shadow-[0_8px_44px_rgba(253,204,75,0.26)]">
            <OutlinedWord text={tagline} word={accentWord} />
          </h1>
        )}

      </div>

      <TonightRail events={tonightEvents} isTonight={isTonight} />
    </section>
  );
}

function LiveEqualiser() {
  return (
    <span className="inline-flex h-3 items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ "--eq-i": i } as React.CSSProperties}
          className="ad-eq-bar h-full w-0.5 rounded-full bg-current"
        />
      ))}
    </span>
  );
}

function cardWidthClass(count: number) {
  if (count === 1) return "w-full min-w-64 max-w-160 sm:w-104";
  return "w-[86%] min-w-64 max-w-160 shrink-0 sm:w-104";
}

function TonightRail({
  events,
  isTonight,
}: {
  events: SerializedEvent[];
  isTonight: boolean;
}) {
  if (events.length === 0) return null;

  const widthClass = cardWidthClass(events.length);
  const single = events.length === 1;

  return (
    <div className="animate-reveal relative z-10 mt-7 w-full text-left [animation-delay:240ms]">
      <div className={cn("mb-3 flex items-center gap-2 sm:justify-center", single && "justify-center")}>
        <span className="inline-flex items-center gap-2.5 rounded-full bg-neon px-4 py-2 text-[#1a0d05] shadow-[0_0_44px_-4px_rgba(255,107,53,0.95)] ring-4 ring-neon/25">
          <span className="ad-blink h-2.5 w-2.5 rounded-full bg-[#1a0d05]" aria-hidden="true" />
          <span className="font-black text-xs tracking-[0.25em] uppercase">
            {isTonight ? "On tonight" : "Next up"}
          </span>
          {isTonight && <LiveEqualiser />}
        </span>
        {events.length > 1 && (
          <span className="inline-flex items-center rounded-full border border-white/15 bg-black/45 px-3 py-1.5 font-black text-[10px] tracking-[0.2em] text-stone-100 uppercase tabular-nums backdrop-blur-sm">
            {events.length} events
          </span>
        )}
      </div>

      <ul
        className={cn(
          "flex items-stretch gap-4 sm:flex-wrap sm:justify-center sm:overflow-x-visible",
          single
            ? "justify-center"
            : "rail-scrollbar snap-x snap-mandatory overflow-x-auto pb-3"
        )}
      >
        {events.map((event) => (
          <li key={event.id} className={cn("snap-start", widthClass)}>
            <TonightCard event={event} isTonight={isTonight} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TonightCard({
  event,
  isTonight,
}: {
  event: SerializedEvent;
  isTonight: boolean;
}) {
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` - ${event.endTimeLabel}` : ""}`
    : null;

  const dateLabel = isTonight ? null : format(dateObj, "EEE d MMM");

  return (
    <article
      className="
        relative flex h-full flex-col overflow-hidden rounded-3xl
        border border-[#FDCC4B]/30 bg-canvas-2/85
        shadow-[0_0_60px_-18px_rgba(253,204,75,0.55)]
        backdrop-blur-md
        sm:flex-row
      "
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      {event.imageUrl && (
        <div className="relative hidden shrink-0 sm:block sm:w-32">
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
          <PosterTint />
          <div className="absolute inset-0 bg-linear-to-r from-transparent to-canvas-2/60" />
        </div>
      )}

      <PosterChip event={event} />

      <div className="grid min-w-0 flex-1 grid-rows-6 p-4 sm:p-5">
        <div className="flex items-center justify-end">
          <PriceChip
            event={event}
            treatUnpricedAsFree={!event.isBookable}
            className="shrink-0"
          />
        </div>

        <div className="row-span-2 flex items-center justify-center">
          <p
            className="ev-text line-clamp-2 text-center font-black text-xl leading-[0.95] tracking-tight uppercase sm:text-2xl"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-center text-xs font-medium text-stone-400 tabular-nums">
          <span className="truncate">{timeLabel}</span>
          {dateLabel && (
            <span className="shrink-0 font-black text-[10px] tracking-[0.2em] uppercase">
              {dateLabel}
            </span>
          )}
        </div>

        <div className="row-span-2 flex items-center justify-center">
          <div className="w-full sm:max-w-44">
            <BookingButton event={event} />
          </div>
        </div>
      </div>
    </article>
  );
}
