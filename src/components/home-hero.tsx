import Image from "next/image";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { EventCta } from "@/components/editorial/event-cta";
import { cn } from "@/lib/utils";
import { parseDate, type SerializedEvent } from "@/lib/events-display";
import type { OpenState } from "@/lib/opening-hours";

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
  openState,
  location,
  mapsHref,
  tonightEvents,
  isTonight,
}: {
  tagline: string | null;
  accentWord?: string;
  openState: OpenState | null;
  location: string | null;
  mapsHref: string | null;
  tonightEvents: SerializedEvent[];
  isTonight: boolean;
}) {
  return (
    <section className="relative pt-3 pb-4 text-center">
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-reveal flex flex-wrap items-center justify-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
              openState?.isOpen
                ? "border-[#FDCC4B]/25 bg-[#FDCC4B]/10"
                : "border-hairline bg-white/5"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                openState?.isOpen ? "ad-ping bg-[#FDCC4B]" : "bg-stone-500"
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "font-black text-[10px] tracking-[0.2em] uppercase",
                openState?.isOpen ? "text-[#FDCC4B]" : "text-stone-400"
              )}
            >
              {openState?.label ?? "Live music & late nights"}
            </span>
          </span>

          {location &&
            (mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/5 px-3.5 py-1.5 transition-colors hover:border-white/30 hover:bg-white/10"
              >
                <MapPin className="h-3 w-3 shrink-0 text-[#FDCC4B]" aria-hidden="true" />
                <span className="font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">
                  {location}
                </span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/5 px-3.5 py-1.5">
                <MapPin className="h-3 w-3 shrink-0 text-[#FDCC4B]" aria-hidden="true" />
                <span className="font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">
                  {location}
                </span>
              </span>
            ))}
        </div>

        {tagline && (
          <h1 className="animate-reveal m-0 mt-5 max-w-3xl font-black text-[clamp(1.5rem,6.4vw,3rem)] leading-[0.92] tracking-tighter text-ink uppercase drop-shadow-[0_8px_44px_rgba(253,204,75,0.26)] [animation-delay:80ms]">
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
    <span
      className="inline-flex h-3 items-end gap-0.5 drop-shadow-[0_0_12px_rgba(255,107,53,0.6)]"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ "--eq-i": i } as React.CSSProperties}
          className="ad-eq-bar h-full w-0.5 rounded-full bg-neon"
        />
      ))}
    </span>
  );
}

function cardWidthClass(count: number) {
  if (count === 1) return "w-full min-w-64 max-w-160 sm:w-fit";
  if (count === 2) return "w-[86%] min-w-64 max-w-160 shrink-0 sm:w-[calc(50%-0.5rem)]";
  return "w-[86%] min-w-64 max-w-160 shrink-0 sm:w-[calc(33.333%-0.667rem)]";
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
      <div className={cn("mb-3 flex items-center gap-2", single && "justify-center")}>
        <span
          className="ad-blink h-2 w-2 rounded-full bg-neon drop-shadow-[0_0_12px_rgba(255,107,53,0.6)]"
          aria-hidden="true"
        />
        <span className="font-black text-[10px] tracking-[0.2em] text-neon uppercase drop-shadow-[0_0_12px_rgba(255,107,53,0.6)]">
          {isTonight ? "On tonight" : "Next up"}
        </span>
        {isTonight && <LiveEqualiser />}
        {events.length > 1 && (
          <span className="font-black text-[10px] tracking-[0.2em] text-stone-500 uppercase tabular-nums">
            {events.length} events
          </span>
        )}
      </div>

      <ul
        className={cn(
          "flex items-center gap-4",
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
    ? `${event.startTimeLabel}${event.endTimeLabel ? `–${event.endTimeLabel}` : ""}`
    : null;

  const priceLabel =
    event.price != null && event.price > 0
      ? `£${event.price}`
      : event.isBookable && event.price === 0
        ? "Free entry"
        : null;

  const meta = [
    isTonight ? null : format(dateObj, "EEE d MMM"),
    timeLabel,
    event.subType,
    priceLabel,
  ].filter(Boolean);

  return (
    <article
      className="flex h-full overflow-hidden rounded-3xl border border-[#FDCC4B]/30 bg-canvas-2/85 shadow-[0_0_60px_-18px_rgba(253,204,75,0.55)] backdrop-blur-md"
      style={{ "--ev-c": event.color } as React.CSSProperties}
    >
      {event.imageUrl && (
        <div className="relative w-24 shrink-0 sm:w-32">
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-r from-transparent to-canvas-2/60" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
        <p className="ev-text line-clamp-2 font-black text-xl leading-[0.95] tracking-tight uppercase sm:text-2xl">
          {event.title}
        </p>

        {meta.length > 0 && (
          <p className="line-clamp-1 text-xs font-medium text-stone-400 tabular-nums">
            {meta.join(" · ")}
          </p>
        )}

        <div className="mt-1 w-full sm:max-w-44">
          <EventCta event={event} size="lg" />
        </div>
      </div>
    </article>
  );
}
