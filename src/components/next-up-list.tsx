import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";
import { groupByDate } from "@/components/ticket-strip";

/* Phone-only "Coming up": the next nights after the featured one, each as
   its own card - date tile on the left, the night's events on the right. */
export function NextUpList({ events }: { events: SerializedEvent[] }) {
  const nights = groupByDate(events);
  return (
    <section id="coming-up" aria-labelledby="coming-up-heading" className="scroll-mt-20 px-4 pt-10 pb-4 md:hidden">
      <h2 id="coming-up-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase">
        Coming up
      </h2>

      {nights.length === 0 ? (
        <p className="mt-3 rounded-[14px] border border-dashed border-white/12 px-4 py-6 text-center text-sm text-ink-2">
          Nothing else booked yet - check the full schedule or follow us for announcements.
        </p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {nights.map((night) => {
            const date = parseDate(night[0].date);
            return (
              <li key={night[0].date} className="flex items-stretch overflow-hidden rounded-[14px] border border-ink/15 bg-canvas-2">
                <span className="flex w-16 shrink-0 items-start justify-center py-2.5 pl-2.5">
                  <span className="flex h-12 w-12 flex-col items-center justify-center rounded-[10px] bg-ink/8 leading-none text-ink">
                    <span className="font-black text-[8px] tracking-[0.12em] text-ink-2 uppercase">{format(date, "EEE")}</span>
                    <span className="mt-0.5 font-black text-xl tracking-tighter tabular-nums">{format(date, "d")}</span>
                  </span>
                </span>
                <ul className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
                  {night.map((e, i) => (
                    <li key={e.id} className={cn(i > 0 && "border-t border-dashed border-ink/12")}>
                      <Link
                        href={`/whats-on/${e.id}`}
                        className="flex min-h-16 items-center gap-2.5 py-2.5 pr-2.5 pl-3 transition-colors active:bg-ink/6"
                        aria-label={`${e.title}, ${format(date, "EEEE d MMMM")}${i > 0 ? ", same night" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black text-sm leading-tight tracking-tight text-ink uppercase">{e.title}</span>
                          <span className="mt-1 block truncate text-[12px] text-ink-2 tabular-nums">
                            {[i > 0 ? "Then" : null, e.startTimeLabel, entryText(e)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-2/60" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/whats-on"
        className="mt-3 flex min-h-11 items-center justify-center gap-1.5 font-black text-[10px] tracking-[0.16em] text-gold uppercase"
      >
        View full schedule
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </section>
  );
}
