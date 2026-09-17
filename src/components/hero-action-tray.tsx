"use client";

import Link from "next/link";
import { useEffect } from "react";
import { format } from "date-fns";
import { Armchair, CalendarPlus, Check, Info, Share2, X } from "lucide-react";
import { useEventActions } from "@/components/event-actions";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";

/* Phone-only bottom sheet behind the hero's "More" key. Everything that is
   not the one primary action lives here: the rest of the night's bill (a tap
   swaps the poster), the event page, a table booking, calendar and share. */
export function HeroActionTray({
  open,
  onClose,
  nightEvents,
  active,
  onSelect,
  isTonight,
}: {
  open: boolean;
  onClose: () => void;
  nightEvents: SerializedEvent[];
  active: number;
  onSelect: (index: number) => void;
  isTonight: boolean;
}) {
  const event = nightEvents[active];
  const { addToCalendar, share, copied } = useEventActions(event);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !event) return null;

  const dateObj = parseDate(event.date);
  const seatedPrimary = event.isBookable && !event.isFullyBooked && event.requiresSeating && Boolean(event.bookingPageUrl);
  const row =
    "flex min-h-13 w-full items-center gap-3.5 px-4 text-left text-sm font-bold text-ink transition-[scale,background-color] duration-150 active:scale-[0.985] active:bg-white/6";
  const icon = "h-4.5 w-4.5 shrink-0 text-gold";

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label={`More for ${event.title}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ad-sheet-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className="ad-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-canvas pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-30px_60px_rgba(0,0,0,0.6)]"
        style={{ "--ev-c": event.color } as React.CSSProperties}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />

        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <p className="font-black text-[10px] tracking-[0.24em] text-gold uppercase">
              {isTonight ? "Tonight" : format(dateObj, "EEEE d MMM")}
            </p>
            <h2 className="mt-1 line-clamp-2 font-black text-2xl leading-[0.95] tracking-tighter text-balance text-ink uppercase">{event.title}</h2>
            <p className="mt-1.5 text-xs text-ink-2 tabular-nums">
              {[event.startTimeLabel, entryText(event)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {nightEvents.length > 1 && (
          <section className="mt-4 px-5" aria-label={isTonight ? "Tonight's bill" : "The bill"}>
            <p className="mb-2 font-black text-[10px] tracking-[0.2em] text-ink-2 uppercase">
              {isTonight ? "Tonight's bill" : `${format(dateObj, "EEEE")}'s bill`}
            </p>
            <ol className="m-0 list-none divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-canvas-2/70 p-0">
              {nightEvents.map((e, i) => {
                const on = i === active;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(i);
                        onClose();
                      }}
                      aria-pressed={on}
                      className={cn(
                        "flex min-h-13 w-full items-center gap-3 border-l-[3px] px-3.5 py-2.5 text-left",
                        on ? "border-gold bg-gold/8" : "border-transparent active:bg-white/6"
                      )}
                    >
                      <span className={cn("w-14 shrink-0 font-black text-[11px] tabular-nums", on ? "text-ink" : "text-ink-2")}>
                        {e.startTimeLabel ?? "Late"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-black text-[13px] leading-tight tracking-tight text-ink uppercase">{e.title}</span>
                        <span className="block truncate text-[11px] text-ink-2">
                          {[i === 0 ? "Headline" : "Support", e.subType].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {on ? (
                        <span className="rounded-full bg-gold px-2 py-1 font-black text-[8px] tracking-[0.18em] text-on-gold uppercase">Showing</span>
                      ) : (
                        <span className="text-ink-2" aria-hidden="true">›</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="mt-4 px-5" aria-label="More options">
          <ul className="m-0 list-none divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-canvas-2/70 p-0">
            <li>
              <Link href={`/whats-on/${event.id}`} className={row}>
                <Info className={icon} aria-hidden="true" />
                Event details
              </Link>
            </li>
            {!seatedPrimary && (
              <li>
                <Link href="/book" className={row}>
                  <Armchair className={icon} aria-hidden="true" />
                  Book a table
                </Link>
              </li>
            )}
            <li>
              <button type="button" onClick={addToCalendar} className={row}>
                <CalendarPlus className={icon} aria-hidden="true" />
                Add to calendar
              </button>
            </li>
            <li>
              <button type="button" onClick={share} className={row} aria-label={copied ? "Link copied" : `Share ${event.title}`}>
                {copied ? <Check className={cn(icon, "text-[#6EE7B7]")} aria-hidden="true" /> : <Share2 className={icon} aria-hidden="true" />}
                {copied ? "Link copied" : "Share"}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
