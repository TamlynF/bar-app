import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Music2 } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import {
  formatGBP,
  type SerializedEvent,
} from "@/lib/events-display";
import { groupSchedule } from "@/lib/home-schedule";
import { cn } from "@/lib/utils";

function priceStamp(e: SerializedEvent) {
  if (e.isFullyBooked) return { label: "Sold out", paid: false };
  if (e.price != null && e.price > 0)
    return { label: `${formatGBP(e.price)} entry`, paid: true };
  return { label: "Free", paid: false };
}

function sentenceCase(text: string | null) {
  if (!text) return null;
  return text.length <= 2 ? text.toUpperCase() : text.charAt(0).toUpperCase() + text.slice(1);
}

function meta(e: SerializedEvent) {
  return [e.subType, e.startTimeLabel].filter(Boolean).join(" · ");
}

function RowMeta({ e }: { e: SerializedEvent }) {
  const subType = sentenceCase(e.subType);
  return (
    <span className="mt-1.25 block text-[13px] leading-[1.3] font-semibold text-ink-2 tabular-nums">
      {e.startTimeLabel && <span className="font-extrabold text-neon">{e.startTimeLabel}</span>}
      {e.startTimeLabel && subType && " · "}
      {subType}
      {e.isFullyBooked && " · Sold out"}
    </span>
  );
}

/* This month's one-off nights. Events on the same date share one card and
   one date tile, stacked in time order, so a Saturday with a band and a late
   set reads as one night. */
export function ComingUpMonths({
  events,
  monthLabel,
  className,
}: {
  events: SerializedEvent[];
  monthLabel: string;
  className?: string;
}) {
  const months = groupSchedule(events);

  return (
    <section id="whats-on" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="What’s on"
        title={`This ${monthLabel}`}
        action={{ href: "/whats-on", label: "View all" }}
        actionInline
      />

      {months.length === 0 ? (
        <p className="border border-dashed border-hairline px-6 py-10 text-center text-body text-ink-2">
          Nothing else dated this month beyond the weekly nights - follow us for
          announcements.
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[18px] border border-hairline bg-canvas-2 sm:hidden">
            {months.flatMap((month) =>
              month.days.map((day) => {
                const [lead, ...rest] = day.events;
                return (
                  <li key={day.date} className="relative grid grid-cols-[44px_1fr_18px] items-center gap-3.5 px-3.5 py-4">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="text-[10px] leading-none font-extrabold tracking-[0.12em] text-ink-2 uppercase">
                        {day.dayShort}
                      </span>
                      <span className="font-display text-[26px] leading-none tracking-[0.01em] text-gold tabular-nums">
                        {day.dayNumber}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/whats-on/${lead.id}`}
                        className="block font-black text-base leading-[1.15] text-balance text-ink uppercase transition-colors after:absolute after:inset-0 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {lead.title}
                      </Link>
                      <RowMeta e={lead} />
                      {rest.map((e) => (
                        <Link
                          key={e.id}
                          href={`/whats-on/${e.id}`}
                          className="relative z-10 mt-2.25 block rounded-r-[10px] border-l-2 border-gold bg-white/[.035] py-2 pr-2.5 pl-3 transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          <span className="mb-1 block text-[9px] leading-none font-extrabold tracking-[0.14em] text-gold uppercase">
                            Then
                          </span>
                          <span className="block font-black text-sm leading-[1.15] text-ink uppercase">{e.title}</span>
                          <RowMeta e={e} />
                        </Link>
                      ))}
                    </div>
                    <span
                      className="size-2 -rotate-45 justify-self-center border-r-2 border-b-2 border-ink-2 opacity-60"
                      aria-hidden="true"
                    />
                  </li>
                );
              }),
            )}
          </ul>
          <div className="hidden flex-col gap-2.5 sm:flex">
            {months.map((month) => (
              <div key={month.key} className="flex flex-col gap-2.5">
                {month.days.map((day) => {
                  const multi = day.events.length > 1;
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "flex items-stretch border bg-canvas-2",
                        multi ? "border-gold" : "border-hairline",
                      )}
                    >
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-hairline py-2.5 lg:w-21">
                        <span className="text-pill font-bold tracking-wide text-ink-2 uppercase">
                          {day.dayShort}
                        </span>
                        <span className="font-black text-h3 leading-none tracking-tighter text-gold tabular-nums">
                          {day.dayNumber}
                        </span>
                        {multi && (
                          <span className="mt-1.5 bg-gold px-1.5 py-0.5 text-pill font-bold tracking-wide text-on-gold uppercase">
                            {day.events.length} on
                          </span>
                        )}
                      </div>
                      <ul className="flex min-w-0 flex-1 flex-col">
                        {day.events.map((e, i) => {
                          const stamp = priceStamp(e);
                          return (
                            <li
                              key={e.id}
                              className={cn(
                                i < day.events.length - 1 &&
                                  "border-b border-dashed border-hairline",
                              )}
                            >
                              <Link
                                href={`/whats-on/${e.id}`}
                                className="flex items-center gap-3 px-3 py-2.5 text-ink transition-colors hover:bg-ink/5 lg:gap-4 lg:px-4 lg:py-3.5"
                              >
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-canvas lg:h-18 lg:w-18">
                                  {e.imageUrl ? (
                                    <Image
                                      src={e.imageUrl}
                                      alt=""
                                      fill
                                      sizes="72px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <Music2
                                      className="absolute inset-0 m-auto h-5 w-5 text-ink-2"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <span className="font-black text-btn leading-tight tracking-tight uppercase lg:text-h3">
                                    {e.title}
                                  </span>
                                  {meta(e) && (
                                    <span className="text-meta text-ink-2">
                                      {meta(e)}
                                    </span>
                                  )}
                                  <span className="lg:hidden">
                                    <PriceStamp {...stamp} />
                                  </span>
                                </div>
                                <span className="hidden lg:inline-flex">
                                  <PriceStamp {...stamp} />
                                </span>
                                <ChevronRight
                                  className="h-4.5 w-4.5 shrink-0 text-ink-2"
                                  aria-hidden="true"
                                />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PriceStamp({ label, paid }: { label: string; paid: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex px-1.5 py-0.5 text-pill font-bold tracking-wide uppercase tabular-nums lg:px-2.5 lg:py-1",
        paid ? "bg-gold text-on-gold" : "border border-hairline text-ink-2",
      )}
    >
      {label}
    </span>
  );
}
