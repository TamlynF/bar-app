import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryText, parseDate, type SerializedEvent } from "@/lib/events-display";
import { groupByDate } from "@/components/ticket-strip";

/* Phone-only "Coming up": one bordered list - date cell on the left, title
   and time on the right. Anything else on the featured night leads it, so a
   second act is never hidden inside the hero. */
export function NextUpList({
  events,
  alsoOn = [],
  alsoOnIsTonight = false,
}: {
  events: SerializedEvent[];
  alsoOn?: SerializedEvent[];
  alsoOnIsTonight?: boolean;
}) {
  const nights = [
    ...(alsoOn.length > 0 ? [{ events: alsoOn, featured: true }] : []),
    ...groupByDate(events).map((night) => ({ events: night, featured: false })),
  ];
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
        <ul className="m-0 mt-3 list-none overflow-hidden rounded-[14px] border border-ink/15 bg-canvas-2 p-0">
          {nights.map(({ events: night, featured }, g) => {
            const date = parseDate(night[0].date);
            return (
              <li key={night[0].date} className={cn("flex items-stretch", g > 0 && "border-t border-ink/12")}>
                <span className="flex w-16 shrink-0 items-start justify-center py-2.5 pl-2.5">
                  <span
                    className={cn(
                      "flex h-12 w-12 flex-col items-center justify-center rounded-[10px] leading-none",
                      featured ? "bg-gold text-canvas" : "bg-ink/8 text-ink"
                    )}
                  >
                    <span className={cn("font-black text-[8px] tracking-[0.12em] uppercase", featured ? "text-canvas/80" : "text-ink-2", featured && alsoOnIsTonight && "tracking-[0.06em]")}>
                      {featured && alsoOnIsTonight ? "Tonight" : format(date, "EEE")}
                    </span>
                    <span className="mt-0.5 font-black text-xl tracking-tighter tabular-nums">{format(date, "d")}</span>
                  </span>
                </span>
                <ul className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
                  {night.map((e, i) => (
                    <li key={e.id} className={cn(i > 0 && "border-t border-dashed border-ink/12")}>
                      <Link
                        href={`/whats-on/${e.id}`}
                        className="flex min-h-16 items-center gap-2.5 px-3 py-2.5"
                        style={{ "--ev-c": e.color } as React.CSSProperties}
                        aria-label={`${e.title}, ${format(date, "EEEE d MMMM")}${featured || i > 0 ? ", same night" : ""}`}
                      >
                        {featured && (
                          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-canvas">
                            {e.imageUrl ? (
                              <Image src={e.imageUrl} alt="" fill sizes="44px" className="object-cover object-[center_70%]" />
                            ) : (
                              <span className="absolute inset-0 bg-linear-to-br from-(--ev-c)/60 to-canvas" aria-hidden="true" />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-black text-sm leading-tight tracking-tight text-ink uppercase">{e.title}</span>
                          <span className="mt-1 block truncate text-[12px] text-ink-2 tabular-nums">
                            {[featured ? (i === 0 ? "Also on" : "Then") : i > 0 ? "Then" : null, e.startTimeLabel, featured ? e.subType : entryText(e)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
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
