import { format } from "date-fns";
import { Clock, CalendarDays, ExternalLink } from "lucide-react";

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
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="neon-text text-[10px] font-black uppercase tracking-[0.25em]">
          {eyebrow}
        </span>
        <div className="flex-1 h-px neon-bg-muted" />
      </div>

      <div className="olive-bg border neon-border rounded-2xl neon-glow overflow-hidden">
        {/* Main event row */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          {/* Date column */}
          <div className="shrink-0 w-10 text-center">
            <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest leading-tight">
              {format(dateObj, "EEE")}
            </p>
            <p className="text-base font-black tabular-nums leading-none text-white">
              {format(dateObj, "d")}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {event.subType && (
              <p className="text-stone-500 text-[9px] font-black uppercase tracking-widest leading-tight mb-0.5">
                {event.subType}
              </p>
            )}

            {event.externalLink ? (
              <a
                href={event.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 min-w-0 max-w-full"
              >
                <p
                  className="ev-text text-sm font-black leading-tight truncate underline underline-offset-2 pb-px"
                  style={{ "--ev-c": event.color } as React.CSSProperties}
                >
                  {event.title}
                </p>
                <ExternalLink className="w-3 h-3 shrink-0 text-stone-500" aria-hidden="true" />
              </a>
            ) : (
              <p
                className="ev-text text-sm font-black leading-tight truncate"
                style={{ "--ev-c": event.color } as React.CSSProperties}
              >
                {event.title}
              </p>
            )}

            {event.startTimeLabel && (
              <p className="flex items-center gap-1 text-stone-400 text-[10px] font-bold tabular-nums mt-0.5">
                <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                {event.startTimeLabel}
                {event.endTimeLabel ? ` – ${event.endTimeLabel}` : ""}
              </p>
            )}
          </div>

          {/* Right side */}
          {event.isFullyBooked && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              Sold Out
            </span>
          )}

          {!event.isFullyBooked && event.isBookable && event.bookingPageUrl && (
            <a
              href={event.bookingPageUrl}
              className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#1a2008] bg-[#FDCC4B] px-2.5 py-1.5 rounded-full hover:bg-[#FDCC4B]/90 active:scale-95 transition-all"
              aria-label={`Book ${event.title}`}
            >
              <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
              Book
            </a>
          )}
        </div>

        {/* Also on the night — sibling events on the same date */}
        {siblings.length > 0 && (
          <div className="border-t neon-border px-4 pb-3">
            <div className="flex gap-3">
              {/* Spacer — matches the date column width so siblings align with the title */}
              <div className="shrink-0 w-10" />
              <div className="flex-1 min-w-0 pt-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-stone-500 text-[9px] font-black uppercase tracking-[0.25em]">
                    Also on the night
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div className="space-y-2">
                  {siblings.map((s) => {
                    const timeLabel = s.startTimeLabel
                      ? `${s.startTimeLabel}${s.endTimeLabel ? ` – ${s.endTimeLabel}` : ""}`
                      : null;
                    const subLine = [s.subType, timeLabel].filter(Boolean).join(" · ");
                    return (
                      <div key={s.id} className="flex items-center gap-2 min-w-0">
                        <span
                          className="ev-dot w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ "--ev-c": s.color } as React.CSSProperties}
                        />
                        <div className="flex-1 min-w-0">
                          {s.externalLink ? (
                            <a
                              href={s.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 min-w-0 max-w-full"
                            >
                              <p
                                className="ev-text text-xs font-black leading-tight truncate underline underline-offset-2 pb-px"
                                style={{ "--ev-c": s.color } as React.CSSProperties}
                              >
                                {s.title}
                              </p>
                              <ExternalLink className="w-3 h-3 shrink-0 text-stone-500" aria-hidden="true" />
                            </a>
                          ) : (
                            <p
                              className="ev-text text-xs font-black leading-tight truncate"
                              style={{ "--ev-c": s.color } as React.CSSProperties}
                            >
                              {s.title}
                            </p>
                          )}
                          {subLine && (
                            <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wide truncate">
                              {subLine}
                            </p>
                          )}
                        </div>
                        {s.isFullyBooked && (
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-red-400">
                            Full
                          </span>
                        )}
                        {!s.isFullyBooked && s.isBookable && s.bookingPageUrl && (
                          <a
                            href={s.bookingPageUrl}
                            className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#1a2008] bg-[#FDCC4B] px-2.5 py-1.5 rounded-full hover:bg-[#FDCC4B]/90 active:scale-95 transition-all"
                            aria-label={`Book ${s.title}`}
                          >
                            <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
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