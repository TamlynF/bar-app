"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { Waveform } from "@/components/ui/waveform";
import { groupByDate } from "@/components/ticket-strip";
import { revealDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  entryText,
  formatGBP,
  parseDate,
  type SerializedEvent,
} from "@/lib/events-display";

const MAX_RECORDS = 3;
const ANGLES = [-8, 0, 8];

/* One date, one sleeve. Every event that night is a record behind it: one
   record peeking out means one event, two means two, three means a busy
   night, and a small "+N" on the last record says there are more. Hover
   pulls the records 70% of the way out; a click or tap pulls them fully
   out with artwork, name, time and price, and closes them again. */
export function DateSleeves({ events }: { events: SerializedEvent[] }) {
  const nights = groupByDate(events);

  return (
    <section
      id="coming-up"
      aria-labelledby="coming-up-heading"
      className="scroll-mt-20 pt-8 pb-4 md:px-6 md:pt-4 lg:px-10"
    >
      <div className="flex items-end justify-between gap-3 px-4 md:px-0">
        <div>
          <span className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-gold">
            <Waveform bars={5} className="h-2.5 text-gold" />
            The crate
          </span>
          <h2
            id="coming-up-heading"
            className="m-0 font-black text-[26px] leading-[0.9] tracking-tighter text-ink uppercase md:text-4xl"
          >
            Next up
          </h2>
        </div>
        <ArrowCta
          href="/whats-on"
          variant="goldOutline"
          size="sm"
          className="ad-cta hidden rounded-full md:inline-flex"
        >
          Full schedule
        </ArrowCta>
        {nights.length > 1 && (
          <span className="pb-0.5 text-[11px] font-semibold text-ink-2 md:hidden">
            Tap a sleeve
          </span>
        )}
      </div>

      {nights.length === 0 ? (
        <p className="mx-4 mt-3 rounded-[14px] border border-dashed border-white/12 px-4 py-6 text-center text-sm text-ink-2 md:mx-0">
          Nothing else booked yet - check the full schedule or follow us for
          announcements.
        </p>
      ) : (
        <ul className="no-scrollbar m-0 mt-4 flex snap-x snap-mandatory list-none items-start gap-5 overflow-x-auto scroll-px-4 px-4 pt-2 pb-4 md:grid md:grid-cols-[repeat(auto-fill,15rem)] md:justify-start md:gap-8 md:overflow-visible md:px-0">
          {nights.map((night, i) => (
            <Crate key={night[0].date} night={night} index={i} />
          ))}
        </ul>
      )}
      <div className="mt-2 px-4 md:hidden">
        <ArrowCta href="/whats-on" variant="goldOutline" className="w-full">
          Full schedule
        </ArrowCta>
      </div>
    </section>
  );
}

function Crate({ night, index }: { night: SerializedEvent[]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const lead = night[0];
  const date = parseDate(lead.date);
  const shown = night.slice(0, MAX_RECORDS);
  const extra = night.length - shown.length;
  const id = `crate-${lead.date}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNudge(true);
        observer.disconnect();
      },
      { threshold: 0.7 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      data-reveal
      className="w-56 shrink-0 snap-start md:w-60"
      style={revealDelay(index)}
    >
      <div
        ref={ref}
        data-open={open}
        className={cn("ad-crate", nudge && "ad-crate-nudge")}
        style={
          { "--n": shown.length, "--ev-c": lead.color } as React.CSSProperties
        }
      >
        <div className="ad-crate-stack">
          <ul id={id} className="m-0 list-none p-0" inert={!open}>
            {shown.map((e, i) => {
              const paid = e.price != null && e.price > 0;
              return (
                <li
                  key={e.id}
                  className="ad-record"
                  style={
                    {
                      "--i": i,
                      "--r": `${ANGLES[i]}deg`,
                      "--ev-c": e.color,
                    } as React.CSSProperties
                  }
                >
                  <Link
                    href={`/whats-on/${e.id}`}
                    className="ad-record-link"
                    aria-label={`${e.title}, ${e.startTimeLabel ?? ""} ${entryText(e)}`}
                  >
                    <span className="ad-record-disc" aria-hidden="true">
                      <span className="ad-vinyl-face ad-record-face">
                        <span className="ad-record-label">
                          {e.imageUrl && (
                            <Image
                              src={e.imageUrl}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </span>
                      </span>
                      {i === shown.length - 1 && extra > 0 && (
                        <span className="ad-record-more">+{extra}</span>
                      )}
                    </span>
                    <span className="ad-record-copy">
                      <span className="block truncate font-black text-[13px] leading-tight tracking-tight text-ink uppercase">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-2 tabular-nums">
                        {[
                          e.startTimeLabel,
                          e.isFullyBooked
                            ? "Sold out"
                            : paid
                              ? formatGBP(e.price ?? 0)
                              : "Free",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={`${format(date, "EEEE d MMMM")}: ${night.length} ${night.length === 1 ? "event" : "events"}. ${open ? "Put the records back" : "Pull the records out"}`}
            className="ad-sleeve group"
          >
            {lead.imageUrl ? (
              <Image
                src={lead.imageUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 224px, 240px"
                className="object-cover object-[center_30%]"
              />
            ) : (
              <span
                className="absolute inset-0 bg-linear-to-br from-(--ev-c)/70 via-canvas-2 to-canvas"
                aria-hidden="true"
              />
            )}
            <span
              className="ad-grain absolute inset-0 opacity-[0.07] mix-blend-overlay"
              aria-hidden="true"
            />
            <span
              className="ad-sleeve-light absolute inset-0"
              aria-hidden="true"
            />
            <span
              className="ad-sleeve-spine absolute inset-y-0 left-0 w-2"
              aria-hidden="true"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/90 via-black/60 to-transparent px-3.5 pt-10 pb-3 text-left">
              <span className="flex flex-col leading-none">
                <span className="text-[10px] font-semibold tracking-wide text-gold uppercase">
                  {format(date, "EEEE")}
                </span>
                <span className="mt-1 font-black text-[44px] leading-[0.85] tracking-tighter text-ink tabular-nums">
                  {format(date, "d")}
                </span>
                <span className="mt-1 text-[10px] font-semibold tracking-wide text-ink-2 uppercase">
                  {format(date, "MMMM")}
                </span>
              </span>
              <span className="max-w-[55%] truncate text-right font-black text-[11px] leading-tight tracking-tight text-ink/85 uppercase">
                {lead.title}
              </span>
            </span>
          </button>
        </div>
      </div>
    </li>
  );
}
