import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import { EventCta } from "@/components/editorial/event-cta";
import { cn } from "@/lib/utils";
import { parseDate, type SerializedEvent } from "@/lib/events-display";
import type { OpenState } from "@/lib/opening-hours";

export function HomeHero({
  tagline,
  openState,
  location,
  mapsHref,
  featured,
  isTonight,
}: {
  tagline: string;
  openState: OpenState | null;
  location: string | null;
  mapsHref: string | null;
  featured: SerializedEvent | null;
  isTonight: boolean;
}) {
  return (
    <section className="relative pt-1 pb-3 text-center sm:pt-3 sm:pb-4">
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

        <h1 className="animate-reveal m-0 mt-3 max-w-3xl font-black text-[clamp(1.75rem,7.5vw,3.5rem)] leading-[0.92] tracking-tighter text-[#FFF4CC] uppercase drop-shadow-[0_8px_44px_rgba(253,204,75,0.26)] [animation-delay:80ms]">
          {tagline}
        </h1>

      </div>

      {featured && <TonightStrip event={featured} isTonight={isTonight} />}
    </section>
  );
}

function TonightStrip({
  event,
  isTonight,
}: {
  event: SerializedEvent;
  isTonight: boolean;
}) {
  const dateObj = parseDate(event.date);
  const timeLabel = event.startTimeLabel
    ? `${event.startTimeLabel}${event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}`
    : null;

  return (
    <div className="animate-reveal relative z-10 mt-7 w-full rounded-3xl border border-hairline bg-canvas-2/85 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur-md [animation-delay:240ms] sm:mt-9 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        {!isTonight && (
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#FDCC4B] text-[#1a2008] shadow-lg shadow-[#FDCC4B]/30">
            <span className="font-black text-[10px] tracking-widest uppercase">
              {format(dateObj, "EEE")}
            </span>
            <span className="font-black text-2xl leading-none tabular-nums">
              {format(dateObj, "d")}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <span
                className="ad-blink h-2 w-2 rounded-full bg-[#FF6B35] shadow-[0_0_10px_#FF6B35]"
                aria-hidden="true"
              />
              <span className="font-black text-[10px] tracking-[0.2em] text-neon uppercase">
                {isTonight ? "On tonight" : "Next up"}
              </span>
            </span>
            {timeLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-400 tabular-nums">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {timeLabel}
              </span>
            )}
            {event.subType && (
              <span className="font-black text-[9px] tracking-[0.25em] text-stone-500 uppercase">
                {event.subType}
              </span>
            )}
          </div>

          <p
            className="ev-text mt-1.5 line-clamp-2 font-black text-2xl leading-[0.95] tracking-tight uppercase sm:text-3xl"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </p>

          {event.tagline && (
            <p className="mt-1 line-clamp-1 text-xs font-medium text-stone-400">
              {event.tagline}
            </p>
          )}
        </div>

        <div className="w-full shrink-0 sm:w-48">
          <EventCta event={event} size="lg" />
        </div>
      </div>
    </div>
  );
}
