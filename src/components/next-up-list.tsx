import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryText, formatGBP, parseDate, type SerializedEvent } from "@/lib/events-display";

/* Phone-only "Next up": the events after the featured night as a row of
   gig-poster cards that swipes sideways - date stamp top-left, entry tag
   top-right, title over the bottom of the poster. */
export function NextUpList({ events }: { events: SerializedEvent[] }) {
  return (
    <section id="coming-up" aria-labelledby="coming-up-heading" className="scroll-mt-20 pt-8 pb-4 md:hidden">
      <div className="flex items-end justify-between gap-3 px-4">
        <h2 id="coming-up-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase">
          Next up
        </h2>
        {events.length > 1 && (
          <span className="pb-0.5 font-black text-[10px] tracking-[0.16em] text-ink-2 uppercase">Swipe for more</span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="mx-4 mt-3 rounded-[14px] border border-dashed border-white/12 px-4 py-6 text-center text-sm text-ink-2">
          Nothing else booked yet - check the full schedule or follow us for announcements.
        </p>
      ) : (
        <ul className="no-scrollbar m-0 mt-3 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
          {events.map((e) => {
            const date = parseDate(e.date);
            const paid = e.price != null && e.price > 0;
            return (
              <li key={e.id} className="w-38 shrink-0 snap-start" style={{ "--ev-c": e.color } as React.CSSProperties}>
                <Link
                  href={`/whats-on/${e.id}`}
                  aria-label={`${e.title}, ${format(date, "EEEE d MMMM")}`}
                  className="relative block aspect-[3/4] overflow-hidden rounded-xl border-2 border-ink/25 bg-canvas-2 shadow-[0_14px_30px_-16px_rgba(0,0,0,0.9)] transition-[scale,border-color] duration-150 active:scale-[0.97] active:border-gold/60"
                >
                  {e.imageUrl ? (
                    <Image src={e.imageUrl} alt="" fill sizes="152px" className="object-cover object-[center_30%]" />
                  ) : (
                    <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/60 via-canvas-2 to-canvas" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 via-45% to-black/10" aria-hidden="true" />

                  <span className="absolute top-2 left-2 flex flex-col items-center rounded-lg bg-canvas/85 px-2 py-1 leading-none text-ink backdrop-blur-sm">
                    <span className="font-black text-[8px] tracking-[0.18em] text-gold uppercase">{format(date, "EEE")}</span>
                    <span className="mt-0.5 font-black text-lg tracking-tighter tabular-nums">{format(date, "d")}</span>
                  </span>
                  <span
                    className={cn(
                      "absolute top-2 right-2 rounded-full px-2 py-0.5 font-black text-[9px] tracking-[0.14em] uppercase",
                      e.isFullyBooked
                        ? "bg-red-500/80 text-white"
                        : paid
                          ? "bg-gold text-on-gold"
                          : "border border-gold/50 bg-canvas/80 text-gold"
                    )}
                  >
                    {e.isFullyBooked ? "Sold out" : paid ? formatGBP(e.price ?? 0) : "Free"}
                  </span>

                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2.5">
                    {e.subType && (
                      <span className="w-fit rounded-sm bg-(--ev-c) px-1.5 py-0.5 font-black text-[8px] tracking-[0.16em] text-canvas uppercase">
                        {e.subType}
                      </span>
                    )}
                    <span className="line-clamp-3 font-black text-[15px] leading-[0.95] tracking-tight text-ink uppercase [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                      {e.title}
                    </span>
                    <span className="truncate text-[10px] font-bold text-ink-2 tabular-nums">
                      {[e.startTimeLabel, entryText(e)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="w-28 shrink-0 snap-start">
            <Link
              href="/whats-on"
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/35 px-3 text-center font-black text-[10px] tracking-[0.16em] text-gold uppercase transition-[scale] duration-150 active:scale-[0.97]"
            >
              Full schedule
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
