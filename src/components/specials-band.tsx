"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronRight, Martini } from "lucide-react";
import { RichTextContent } from "@/components/rich-text-content";
import { SpecialDetailModal } from "@/components/special-detail-modal";
import type { SpecialRow } from "@/components/specials-section";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_SPECIALS = 4;

function todayDow(today: Date) {
  const d = today.getDay();
  return d === 0 ? 7 : d;
}

function runsToday(s: SpecialRow, today: Date) {
  return !s.days_of_week?.length || s.days_of_week.length >= 7 || s.days_of_week.includes(todayDow(today));
}

function whenLabel(s: SpecialRow, today: Date) {
  if (runsToday(s, today)) return "Tonight";
  const days = [...(s.days_of_week ?? [])].sort((a, b) => a - b);
  if (!days.length || days.length >= 7) return "All week";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (["5,6", "5,6,7", "6,7"].includes(days.join())) return "Weekend";
  const t = todayDow(today);
  const next = days.find((d) => d > t) ?? days[0];
  return next === (t % 7) + 1 ? "Tomorrow" : days.map((d) => DAY_SHORT[d]).join(" Â· ");
}

/* The burgundy Specials band. Phones: the first special (tonight's, or the
   next one up) is a full-width photo card and the rest are one-line rows
   beneath it. From md the title sits left and each special is a
   photo-and-copy pair beside it, as in the design. Tonight's run first.
   Tapping opens the special's own popup; nothing leaves the page. */
export function SpecialsBand({ specials, today }: { specials: SpecialRow[]; today: Date }) {
  const [open, setOpen] = useState<SpecialRow | null>(null);
  if (specials.length === 0) return null;

  const ordered = [...specials].sort((a, b) => Number(runsToday(b, today)) - Number(runsToday(a, today))).slice(0, MAX_SPECIALS);
  const cols = ordered.length >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : ordered.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";
  const tonightCount = ordered.filter((s) => runsToday(s, today)).length;
  const countLabel = tonightCount > 1 ? `${tonightCount} on tonight` : `${ordered.length} on this week`;

  return (
    <section
      id="specials"
      aria-labelledby="specials-heading"
      className="relative mx-4 mt-6 overflow-hidden rounded-2xl border border-ink/15 bg-[#7a1f1f] p-4 sm:mx-6 sm:mt-8 sm:p-5 md:rounded-[20px] md:p-6 lg:mx-10"
    >
      <div className="pointer-events-none absolute -top-30 right-50 h-90 w-90 rounded-full bg-gold/12 blur-[70px] max-md:-top-17.5 max-md:-right-12.5 max-md:h-55 max-md:w-55 max-md:blur-[50px]" aria-hidden="true" />

      <div className="relative md:flex md:items-center md:gap-7">
        <div className="flex items-end justify-between gap-3 md:w-60 md:shrink-0 md:flex-col md:items-start md:justify-center md:gap-2">
          <div>
            <h2 id="specials-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase md:text-[40px]">
              Specials
            </h2>
            <p className="mt-2 mb-0 hidden text-[13px] leading-snug font-semibold text-gold md:block">
              Good drinks.<br />Better company.
            </p>
          </div>
          {ordered.length > 1 && (
            <span className="shrink-0 pb-0.5 font-black text-[11px] tracking-[0.14em] text-ink/70 uppercase md:mt-2 md:text-[10px] md:tracking-[0.16em]">
              {countLabel}
            </span>
          )}
        </div>

        <ul className="no-scrollbar relative -mx-4 mt-3 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:hidden">
          {ordered.map((s) => {
            const tonight = runsToday(s, today);
            return (
              <li key={s.id} className={cn("shrink-0 snap-start", ordered.length === 1 ? "w-full" : "w-[calc(50%-0.375rem)]")}>
                <button
                  type="button"
                  onClick={() => setOpen(s)}
                  aria-label={`${s.title} - details`}
                  className={cn(
                    "relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[radial-gradient(80%_70%_at_50%_30%,#6b3a12,#2a130c_70%,#170c08)] text-left transition-transform active:scale-[0.97]",
                    tonight ? "ring-2 ring-gold ring-offset-2 ring-offset-[#7a1f1f]" : "border border-ink/15"
                  )}
                >
                  {s.image_url ? (
                    <Image src={s.image_url} alt="" fill sizes="(max-width: 768px) 50vw, 168px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-gold" aria-hidden="true">
                      <Martini className="h-8 w-8" strokeWidth={1.6} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "absolute top-2 left-2 rounded-full px-2 py-0.5 font-black text-[10px] tracking-[0.14em] uppercase",
                      tonight ? "bg-gold text-on-gold" : "bg-black/70 text-ink"
                    )}
                  >
                    {whenLabel(s, today)}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 block rounded-b-xl bg-black/85 px-2.5 py-2">
                    <span className="line-clamp-3 font-black text-[13px] leading-tight tracking-tight text-gold uppercase">{s.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className={cn("relative m-0 mt-3 hidden list-none flex-col gap-2 p-0 md:mt-0 md:grid md:min-w-0 md:flex-1 md:gap-5", cols)}>
          {ordered.map((s) => {
            const tonight = runsToday(s, today);
            const badge = s.badges?.[0] ?? null;
            return (
              <li key={s.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpen(s)}
                  aria-label={`${s.title} - details`}
                  className={cn(
                    "flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-black/25 p-2 text-left transition-colors hover:bg-black/35 md:gap-4 md:rounded-2xl md:p-2.5",
                    tonight ? "border-gold/60" : "border-ink/15"
                  )}
                >
                  <span className="relative h-18 w-18 shrink-0 overflow-hidden rounded-lg bg-[radial-gradient(80%_70%_at_50%_30%,#6b3a12,#2a130c_70%,#170c08)] md:h-30 md:w-42 md:rounded-xl">
                    {s.image_url ? (
                      <Image src={s.image_url} alt="" fill sizes="(max-width: 768px) 72px, 168px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-gold" aria-hidden="true">
                        <Martini className="h-7 w-7 md:h-10 md:w-10" strokeWidth={1.6} />
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col md:py-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-full px-1.5 py-0.5 font-black text-[8px] tracking-[0.16em] uppercase md:px-2 md:text-[9px]", tonight ? "bg-gold text-on-gold" : "bg-canvas/70 text-ink")}>
                        {whenLabel(s, today)}
                      </span>
                      {badge && <span className="font-black text-[8px] tracking-[0.16em] text-ink/70 uppercase md:text-[9px]">{badge}</span>}
                    </span>
                    <span className="mt-1 truncate font-black text-sm leading-tight tracking-tight text-gold uppercase md:mt-1.5 md:text-[22px]">{s.title}</span>
                    {s.description && (
                      <RichTextContent
                        html={s.description}
                        variant="public"
                        className="rich-content--md mt-0.5 line-clamp-1 text-[11px] text-ink/70 md:mt-1 md:line-clamp-2 md:text-xs md:text-ink/75"
                      />
                    )}
                    <span className="mt-2.5 hidden h-9 items-center justify-center self-start rounded-lg border border-gold px-3.5 font-black text-[10px] tracking-[0.14em] text-gold uppercase md:inline-flex">
                      See special
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink/70 md:hidden" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {open && <SpecialDetailModal special={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
