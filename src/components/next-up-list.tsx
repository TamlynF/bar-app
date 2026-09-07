import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";
import { groupByDate } from "@/components/ticket-strip";

/* Phone-only "Coming up": the next events after the featured night as one
   bordered list - date cell on the left, title and time on the right. */
export function NextUpList({ events }: { events: SerializedEvent[] }) {
  return (
    <section id="coming-up" aria-labelledby="coming-up-heading" className="scroll-mt-20 px-4 pt-4 md:hidden">
      <div className="flex items-end justify-between gap-3">
        <h2 id="coming-up-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase">
          Coming up
        </h2>
        <Link
          href="/whats-on"
          className="inline-flex min-h-11 items-center gap-1.5 font-black text-[9px] tracking-[0.16em] text-gold uppercase"
        >
          View full schedule
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 rounded-[14px] border border-dashed border-white/12 px-4 py-6 text-center text-sm text-ink-2">
          Nothing else booked yet - check the full schedule or follow us for announcements.
        </p>
      ) : (
        <ul className="m-0 mt-3 list-none overflow-hidden rounded-[14px] border border-ink/15 bg-canvas-2 p-0">
          {groupByDate(events).map((night, g) => {
            const date = parseDate(night[0].date);
            const first = g === 0;
            return (
              <li key={night[0].date} className={cn("flex items-stretch", g > 0 && "border-t border-ink/12")}>
                <span className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-ink/12 py-2.5">
                  <span className={cn("font-black text-[9px] tracking-[0.16em] uppercase", first ? "text-gold" : "text-ink-2")}>
                    {format(date, "EEE")}
                  </span>
                  <span className={cn("font-black text-xl leading-none tracking-tighter tabular-nums", first ? "text-gold" : "text-ink")}>
                    {format(date, "d")}
                  </span>
                  {night.length > 1 && (
                    <span className="mt-1 rounded-full bg-gold/15 px-1.5 py-0.5 font-black text-[7px] tracking-[0.14em] text-gold uppercase">
                      {night.length} on
                    </span>
                  )}
                </span>
                <ul className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
                  {night.map((e, i) => (
                    <li key={e.id} className={cn(i > 0 && "border-t border-dashed border-ink/12")}>
                      <Link
                        href={`/whats-on/${e.id}`}
                        className="flex min-h-16 items-center gap-2.5 px-3 py-2.5"
                        aria-label={`${e.title}, ${format(date, "EEEE d MMMM")}${i > 0 ? ", same night" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black text-sm leading-tight tracking-tight text-ink uppercase">{e.title}</span>
                          <span className="mt-1 block truncate font-black text-[9px] tracking-[0.12em] text-gold uppercase tabular-nums">
                            {[i > 0 ? "Then" : null, e.startTimeLabel, entryText(e)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
