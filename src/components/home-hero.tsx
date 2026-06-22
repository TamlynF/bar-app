import Image from "next/image";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { EventCta } from "@/components/editorial/event-cta";
import { parseDate, type SerializedEvent } from "@/lib/events-display";

/**
 * Public home hero — "After Dark" direction. A centred, late-night signage
 * moment on the dark olive/gold palette: a live "open" pill, the brand
 * wordmark lit by a gold glow, the tagline, and a featured "on tonight / next
 * up" card for the soonest event. Soft gold + burgundy blurs sit behind.
 *
 * Per STYLE_GUIDE.md the brand wordmark is sanctioned here (home hero) + nav
 * only — this is the one page that gets hero brand treatment.
 */
export function HomeHero({
  tagline,
  openLabel,
  featured,
  isTonight,
}: {
  tagline: string;
  openLabel: string;
  featured: SerializedEvent | null;
  isTonight: boolean;
}) {
  return (
    <section className="relative pt-10 pb-4 sm:pt-14 sm:pb-6 text-center">
      <div className="relative z-10 flex flex-col items-center">
        {/* Live open pill */}
        <div className="animate-reveal inline-flex items-center gap-2 bg-[#FDCC4B]/10 border border-[#FDCC4B]/25 rounded-full px-3.5 py-1.5">
          <span className="ad-ping w-1.5 h-1.5 rounded-full bg-[#FDCC4B]" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FDCC4B]">
            {openLabel}
          </span>
        </div>

        {/* Brand wordmark — lit from above */}
        <h1 className="animate-reveal [animation-delay:80ms] m-0 mt-6 w-full">
          <Image
            src="/CompanyName.png"
            alt="Don Fenticas — live music bar in Hinckley"
            width={560}
            height={150}
            priority
            className="mx-auto h-auto w-[82%] max-w-150 object-contain drop-shadow-[0_8px_44px_rgba(253,204,75,0.26)]"
          />
        </h1>

        <p className="animate-reveal [animation-delay:160ms] mt-4 max-w-md text-ink-2 text-sm sm:text-base font-medium leading-relaxed">
          {tagline}
        </p>

        {/* Featured "on tonight / next up" card */}
        {featured && (
          <FeaturedCard event={featured} isTonight={isTonight} />
        )}
      </div>
    </section>
  );
}

function FeaturedCard({
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
    <div className="animate-reveal [animation-delay:240ms] mt-8 w-full max-w-150 text-left bg-canvas-2 border border-hairline rounded-3xl p-6 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2">
        <span className="ad-blink w-2 h-2 rounded-full bg-[#FF6B35] shadow-[0_0_10px_#FF6B35]" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">
          {isTonight ? "On tonight" : "Next up"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {/* Gold date chip */}
        <div className="shrink-0 w-18 h-18 rounded-2xl bg-[#FDCC4B] text-[#1a2008] flex flex-col items-center justify-center shadow-lg shadow-[#FDCC4B]/30">
          <span className="text-[11px] font-black uppercase tracking-widest">
            {format(dateObj, "EEE")}
          </span>
          <span className="text-3xl font-black tabular-nums leading-none mt-0.5">
            {format(dateObj, "d")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {event.subType && (
            <p className="text-stone-400 text-[9px] font-black uppercase tracking-[0.25em]">
              {event.subType}
            </p>
          )}
          <p
            className="ev-text font-black uppercase tracking-tight leading-[0.95] text-2xl sm:text-3xl line-clamp-2 mt-0.5"
            style={{ "--ev-c": event.color } as React.CSSProperties}
          >
            {event.title}
          </p>
          {(event.tagline || timeLabel) && (
            <p className="mt-1 flex items-center gap-1.5 text-stone-400 text-xs font-medium">
              {timeLabel && (
                <span className="inline-flex items-center gap-1 tabular-nums font-bold">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {timeLabel}
                </span>
              )}
              {event.tagline && timeLabel && <span aria-hidden="true">·</span>}
              {event.tagline && <span className="truncate">{event.tagline}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <EventCta event={event} size="lg" />
      </div>
    </div>
  );
}
