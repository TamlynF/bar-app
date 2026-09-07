import Image from "next/image";
import { format } from "date-fns";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { BookingButton } from "@/components/editorial/booking-button";
import { PriceChip } from "@/components/editorial/event-poster";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";

export function groupByDate(events: SerializedEvent[]) {
  const groups: SerializedEvent[][] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last[0].date === e.date) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/* Tablet/desktop "Next up": one column per night, so everything on the same
   night lives inside the same frame. The headline act is a ticket stub with
   the image; anything after it on that night is a compact row beneath. */
export function TicketStrip({
  events,
  rangeLabel,
  doorsFor,
}: {
  events: SerializedEvent[];
  rangeLabel: string | null;
  doorsFor: (date: string) => string | null;
}) {
  const nights = groupByDate(events);

  return (
    <section aria-labelledby="next-up-heading" className="hidden scroll-mt-24 px-6 pt-2 md:block lg:px-10">
      <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="mb-2 block font-black text-xs tracking-[0.3em] text-gold uppercase">
            {rangeLabel ? `The schedule · ${rangeLabel}` : "The schedule"}
          </span>
          <h2 id="next-up-heading" className="m-0 font-black text-4xl leading-[0.95] tracking-tighter text-ink uppercase">
            Next up
          </h2>
        </div>
        <Link
          href="/whats-on"
          className="group inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 font-black text-[11px] tracking-widest text-ink uppercase transition-colors hover:border-gold/60 hover:text-gold"
        >
          Full schedule
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      {nights.length === 0 ? (
        <p className="mt-7 rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center text-sm text-ink-2">
          Nothing else booked yet - check the full schedule or follow us for announcements.
        </p>
      ) : (
        <ol
          className={cn(
            "m-0 mt-8 grid list-none items-start gap-5 p-0",
            nights.length >= 3 ? "grid-cols-3" : nights.length === 2 ? "grid-cols-2 lg:max-w-4xl" : "grid-cols-1 lg:max-w-md"
          )}
        >
          {nights.map((night, g) => {
            const date = parseDate(night[0].date);
            const [headline, ...rest] = night;
            const isNext = g === 0;
            const doors = doorsFor(night[0].date);
            return (
              <li
                key={night[0].date}
                style={{ "--i": g } as React.CSSProperties}
                className={cn(
                  "ad-rise flex flex-col gap-3 rounded-3xl border p-3",
                  isNext ? "border-gold/35 bg-gold/5 shadow-[0_0_60px_-28px_rgba(253,204,75,0.5)]" : "border-white/12 bg-white/4"
                )}
              >
                <header className="flex items-center justify-between gap-3 px-1 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "inline-block -rotate-2 rounded-lg px-3 py-2 font-black text-base leading-none tracking-[0.12em] uppercase shadow-lg shadow-black/40",
                        isNext ? "bg-gold text-on-gold" : "bg-canvas-2 text-ink ring-1 ring-hairline"
                      )}
                    >
                      {format(date, "EEE")}
                    </span>
                    <span className="font-black text-3xl leading-none tracking-tighter text-ink tabular-nums">{format(date, "d")}</span>
                    <span className="font-black text-[11px] tracking-[0.2em] text-ink-2 uppercase">{format(date, "MMM")}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-black text-[9px] tracking-[0.2em] uppercase",
                      night.length > 1 ? "bg-gold text-on-gold" : isNext ? "bg-canvas text-gold" : "bg-white/6 text-ink-2"
                    )}
                  >
                    {night.length > 1 ? `${night.length} events · one night` : isNext ? "Next night" : "Open"}
                  </span>
                </header>

                <Ticket event={headline} accent={isNext} />

                {rest.length > 0 && (
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {rest.map((e) => (
                      <li
                        key={e.id}
                        style={{ "--ev-c": e.color } as React.CSSProperties}
                        className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-canvas-2/80 py-2 pr-2 pl-2"
                      >
                        <Link href={`/whats-on/${e.id}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-canvas" aria-label={`View details for ${e.title}`}>
                          {e.imageUrl ? (
                            <Image src={e.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                          ) : (
                            <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/60 to-canvas" aria-hidden="true" />
                          )}
                        </Link>
                        <Link href={`/whats-on/${e.id}`} className="min-w-0 flex-1">
                          <span className="block font-black text-[9px] tracking-[0.18em] text-gold uppercase tabular-nums">
                            Then · {e.startTimeLabel ?? "late"}
                          </span>
                          <span className="mt-0.5 block truncate font-black text-sm tracking-tight text-ink uppercase">{e.title}</span>
                          <span className="block truncate text-[11px] text-ink-2">{[e.subType, entryText(e)].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <div className="shrink-0 [&_a]:h-10 [&_a]:w-auto [&_a]:rounded-xl [&_a]:px-3.5 [&_a]:text-[11px] [&_span]:h-10 [&_span]:w-auto [&_span]:rounded-xl [&_span]:px-3 [&_span]:text-[10px]">
                          <BookingButton event={e} />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {doors && (
                  <p className="m-0 inline-flex items-center gap-1.5 px-1 pb-1 text-[11px] text-ink-2 tabular-nums">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Doors {doors}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Ticket({ event: e, accent }: { event: SerializedEvent; accent: boolean }) {
  const time = e.startTimeLabel ? `${e.startTimeLabel}${e.endTimeLabel ? ` – ${e.endTimeLabel}` : ""}` : null;
  return (
    <article
      style={{ "--ev-c": e.color } as React.CSSProperties}
      className="relative flex flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas-2"
    >
      <Link href={`/whats-on/${e.id}`} className="relative block h-44 overflow-hidden bg-canvas lg:h-50">
        {e.imageUrl ? (
          <Image src={e.imageUrl} alt="" fill sizes="(max-width: 1280px) 33vw, 440px" className="object-cover object-[center_30%]" />
        ) : (
          <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/50 via-canvas-2 to-canvas" aria-hidden="true" />
        )}
        <span className="absolute inset-0 bg-linear-to-t from-canvas/85 to-canvas/10" aria-hidden="true" />
        {e.subType && (
          <span className="absolute top-0 left-0 rounded-tl-[20px] rounded-br-xl bg-(--ev-c) px-3.5 py-2 font-black text-[11px] tracking-[0.18em] text-canvas uppercase shadow-lg shadow-black/40">
            {e.subType}
          </span>
        )}
        <PriceChip event={e} treatUnpricedAsFree={!e.isBookable} />
        <span className={cn("absolute bottom-3.5 left-4 font-black text-sm tracking-wide tabular-nums", accent ? "text-gold" : "text-ink")}>
          {time ?? "Tonight"}
        </span>
      </Link>
      <div className="ad-ticket-perf mx-3" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="m-0 truncate font-black text-[22px] leading-none tracking-tight text-ink uppercase">
          <Link href={`/whats-on/${e.id}`}>{e.title}</Link>
        </h3>
        <p className="mt-2 truncate text-xs text-ink-2">{[e.tagline, entryText(e)].filter(Boolean).join(" · ")}</p>
        <div className="mt-4 [&_a]:h-11 [&_a]:rounded-xl [&_a]:text-xs [&_span]:h-11 [&_span]:rounded-xl [&_span]:text-[11px]">
          <BookingButton event={e} />
        </div>
      </div>
    </article>
  );
}
