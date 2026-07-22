import { format } from "date-fns";
import { Clock, CalendarDays, ExternalLink, Mic2 } from "lucide-react";

type HeroEvent = {
  id: number;
  title: string;
  date: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  externalLink: string | null;
  isFullyBooked: boolean;
  isBookable: boolean;
  bookingPageUrl: string | null;
  color: string;
  subType: string | null;
  isKaraoke: boolean;
  karaokeRequestUrl: string | null;
};

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

export function NextEventHero({
  event,
  isTonight,
  siblings,
}: {
  event: HeroEvent;
  isTonight: boolean;
  siblings: HeroEvent[];
}) {
  const dateObj = parseDate(event.date);
  const eyebrow = isTonight
    ? `Tonight · ${format(dateObj, "EEE d")}`
    : `Next up · ${format(dateObj, "EEE d MMM")}`;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="neon-text font-black text-[10px] tracking-[0.25em] uppercase">
          {eyebrow}
        </span>
        <div className="neon-bg-muted h-px flex-1" />
      </div>

      <div className="olive-bg neon-border neon-glow overflow-hidden rounded-2xl border">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-10 shrink-0 text-center">
            <p className="font-black text-[9px] leading-tight tracking-widest text-stone-500 uppercase">
              {format(dateObj, "EEE")}
            </p>
            <p className="font-black text-base leading-none text-white tabular-nums">
              {format(dateObj, "d")}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            {event.subType && (
              <p className="mb-0.5 font-black text-[9px] leading-tight tracking-widest text-stone-500 uppercase">
                {event.subType}
              </p>
            )}

            {event.externalLink ? (
              <a
                href={event.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full min-w-0 items-center gap-1"
              >
                <p
                  className="ev-text truncate pb-px font-black text-sm leading-tight underline underline-offset-2"
                  style={{ "--ev-c": event.color } as React.CSSProperties}
                >
                  {event.title}
                </p>
                <ExternalLink className="h-3 w-3 shrink-0 text-stone-500" aria-hidden="true" />
              </a>
            ) : (
              <p
                className="ev-text truncate font-black text-sm leading-tight"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              >
                {event.title}
              </p>
            )}

            {event.startTimeLabel && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-stone-400 tabular-nums">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {event.startTimeLabel}
                {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}
              </p>
            )}
          </div>

          {event.isFullyBooked && (
            <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-black text-[9px] tracking-widest text-red-400 uppercase">
              Sold Out
            </span>
          )}

          {!event.isFullyBooked && event.isKaraoke && event.karaokeRequestUrl && (
            <a
              href={event.karaokeRequestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-white uppercase transition-all hover:bg-[#FF6B35]/90 active:scale-95"
              aria-label="Request a song to sing on Singa"
            >
              <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              Sing
            </a>
          )}

          {!event.isFullyBooked && event.isKaraoke && !event.karaokeRequestUrl && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 font-black text-[9px] tracking-wide text-stone-500 uppercase"
              title="Karaoke night hasn't started yet"
            >
              <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              Not Started
            </span>
          )}

          {!event.isFullyBooked && !event.isKaraoke && event.isBookable && event.bookingPageUrl && (
            <a
              href={event.bookingPageUrl}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FDCC4B] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-[#1a2008] uppercase transition-all hover:bg-[#FDCC4B]/90 active:scale-95"
              aria-label={`Book ${event.title}`}
            >
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
              Book
            </a>
          )}
        </div>

        {siblings.length > 0 && (
          <div className="neon-border border-t px-4 pb-3">
            <div className="flex gap-3">
              <div className="w-10 shrink-0" />
              <div className="min-w-0 flex-1 pt-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-black text-[9px] tracking-[0.25em] text-stone-500 uppercase">
                    Also on the night
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-2">
                  {siblings.map((s) => {
                    const timeLabel = s.startTimeLabel
                      ? `${s.startTimeLabel}${s.endTimeLabel ? ` – ${s.endTimeLabel}` : ""}`
                      : null;
                    const subLine = [s.subType, timeLabel].filter(Boolean).join(" · ");
                    return (
                      <div key={s.id} className="flex min-w-0 items-center gap-2">
                        <span
                          className="ev-dot h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ "--ev-c": s.color } as React.CSSProperties}
                        />
                        <div className="min-w-0 flex-1">
                          {s.externalLink ? (
                            <a
                              href={s.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full min-w-0 items-center gap-1"
                            >
                              <p
                                className="ev-text truncate pb-px font-black text-xs leading-tight underline underline-offset-2"
                                style={{ "--ev-c": s.color } as React.CSSProperties}
                              >
                                {s.title}
                              </p>
                              <ExternalLink className="h-3 w-3 shrink-0 text-stone-500" aria-hidden="true" />
                            </a>
                          ) : (
                            <p
                              className="ev-text truncate font-black text-xs leading-tight"
                              style={{ "--ev-c": s.color } as React.CSSProperties}
                            >
                              {s.title}
                            </p>
                          )}
                          {subLine && (
                            <p className="truncate text-[10px] font-bold tracking-wide text-stone-500 uppercase">
                              {subLine}
                            </p>
                          )}
                        </div>
                        {s.isFullyBooked && (
                          <span className="shrink-0 font-black text-[8px] tracking-widest text-red-400 uppercase">
                            Full
                          </span>
                        )}
                        {!s.isFullyBooked && s.isKaraoke && s.karaokeRequestUrl && (
                          <a
                            href={s.karaokeRequestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-white uppercase transition-all hover:bg-[#FF6B35]/90 active:scale-95"
                            aria-label="Request a song to sing on Singa"
                          >
                            <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Sing
                          </a>
                        )}
                        {!s.isFullyBooked && s.isKaraoke && !s.karaokeRequestUrl && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 font-black text-[9px] tracking-wide text-stone-500 uppercase"
                            title="Karaoke night hasn't started yet"
                          >
                            <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Not Started
                          </span>
                        )}
                        {!s.isFullyBooked && !s.isKaraoke && s.isBookable && s.bookingPageUrl && (
                          <a
                            href={s.bookingPageUrl}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FDCC4B] px-2.5 py-1.5 font-black text-[9px] tracking-wide text-[#1a2008] uppercase transition-all hover:bg-[#FDCC4B]/90 active:scale-95"
                            aria-label={`Book ${s.title}`}
                          >
                            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Book
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}