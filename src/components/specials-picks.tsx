"use client";

import { useId, useState } from "react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { RichTextContent } from "@/components/rich-text-content";
import type { SpecialRow } from "@/components/specials-section";
import { cn } from "@/lib/utils";

const MAX = 3;
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* JS getDay() (Sun=0) -> our Mon=1..Sun=7 */
function todayDow(today: Date) {
  const d = today.getDay();
  return d === 0 ? 7 : d;
}

function validToday(s: SpecialRow, today: Date, todayStr: string) {
  const dayOk = !s.days_of_week?.length || s.days_of_week.length >= 7 || s.days_of_week.includes(todayDow(today));
  const startOk = !s.start_date || s.start_date <= todayStr;
  const endOk = !s.end_date || s.end_date >= todayStr;
  return dayOk && startOk && endOk;
}

function whenWord(s: SpecialRow, tonight: boolean) {
  if (tonight) return "Tonight";
  const days = [...(s.days_of_week ?? [])].sort((a, b) => a - b);
  if (!days.length || days.length >= 7) return "All week";
  if (days.join() === "5,6" || days.join() === "5,6,7" || days.join() === "6,7") return "Weekend";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  const joined = days.map((d) => DAY_SHORT[d]).join(" · ");
  return joined.length <= 12 ? joined : `${days.length} nights`;
}

function DayPills({ days, today }: { days: number[]; today: Date }) {
  const list = [...(days ?? [])].sort((a, b) => a - b);
  const all = !list.length || list.length >= 7;
  const t = todayDow(today);
  const pills = all ? [{ label: "All week", on: true }] : list.map((d) => ({ label: DAY_SHORT[d], on: d === t }));
  return (
    <span className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <span
          key={p.label}
          className={cn(
            "rounded-full px-2 py-0.5 font-black text-[9px] tracking-[0.16em] uppercase",
            p.on ? "bg-gold text-on-gold" : "border border-gold/40 text-gold"
          )}
        >
          {p.label}
        </span>
      ))}
    </span>
  );
}

/* "Specials" as guitar picks. Phones (container < 48rem): a row of up to 3
   pick tabs and one panel showing the active special (tonight's by default).
   Tablet/desktop: three cards, each with its pick sitting on the top edge like
   a file-folder tab, tonight's in gold. One component, switched by a CSS
   container query. */
export function SpecialsPicks({ specials, today }: { specials: SpecialRow[]; today: Date }) {
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const items = specials.slice(0, MAX);
  const tonightIdx = items.findIndex((s) => validToday(s, today, todayStr));
  const [active, setActive] = useState(Math.max(0, tonightIdx));
  const baseId = useId();

  if (items.length === 0) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    setActive(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <section aria-labelledby={`${baseId}-heading`} className="@container mx-auto w-full max-w-400 px-4 sm:px-6 lg:px-10">
      <SectionHeading
        id={`${baseId}-heading`}
        eyebrow="At the bar"
        title="Specials"
      />

      {/* ---- compact: picks as tabs + one panel ---- */}
      <div className="@3xl:hidden">
        <div role="tablist" aria-label="Specials" onKeyDown={onKey} className="flex gap-2">
          {items.map((s, i) => {
            const on = i === active;
            const tonight = i === tonightIdx;
            return (
              <button
                key={s.id}
                id={`${baseId}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${baseId}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  "ad-pick flex min-h-14 flex-1 flex-col items-center justify-center px-2 pt-2 pb-3 text-center transition-[background-color,color,transform] duration-200 active:scale-[0.97]",
                  on ? "bg-gold text-on-gold" : "bg-white/8 text-ink-2"
                )}
              >
                <span className="line-clamp-1 font-black text-[11px] leading-tight tracking-tight uppercase">{s.title}</span>
                <span className={cn("mt-0.5 font-black text-[8px] tracking-[0.18em] uppercase", on ? "text-on-gold/70" : "text-ink-2/70")}>
                  {whenWord(s, tonight)}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          className="mt-3 min-h-32 rounded-xl border border-white/10 bg-canvas-2/80 p-4"
        >
          {items.map((s, i) => (
            <div
              key={s.id}
              hidden={i !== active}
              className="ad-fade-in"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-sm leading-tight tracking-tight text-ink uppercase">{s.title}</h3>
                {s.badges?.[0] && (
                  <span className="shrink-0 font-black text-sm text-gold tabular-nums">{s.badges[0]}</span>
                )}
              </div>
              {s.description && (
                <RichTextContent html={s.description} variant="public" className="rich-content--md mt-1.5 line-clamp-2 text-[12px] text-ink-2" />
              )}
              <div className="mt-3">
                <DayPills days={s.days_of_week} today={today} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- expanded: cards with a pick on the top edge ---- */}
      <ul className="hidden gap-4 pt-3 @3xl:grid @3xl:grid-cols-3">
        {items.map((s, i) => {
          const tonight = i === tonightIdx;
          return (
            <li
              key={s.id}
              style={{ "--i": i } as React.CSSProperties}
              className={cn(
                "ad-rise relative rounded-2xl border bg-canvas-2/80 p-5 pt-7",
                tonight ? "border-gold" : "border-hairline"
              )}
            >
              <span
                className={cn(
                  "ad-pick absolute -top-3 left-4 px-3.5 pt-1.5 pb-2 font-black text-[10px] tracking-[0.18em] uppercase",
                  tonight ? "bg-gold text-on-gold" : "bg-[#2a2f1c] text-ink-2 ring-1 ring-hairline"
                )}
              >
                {whenWord(s, tonight)}
              </span>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-lg leading-tight tracking-tight text-ink uppercase">{s.title}</h3>
                {s.badges?.[0] && <span className="shrink-0 font-black text-lg text-gold tabular-nums">{s.badges[0]}</span>}
              </div>
              {s.description && (
                <RichTextContent html={s.description} variant="public" className="rich-content--md mt-2 line-clamp-3 text-sm text-ink-2" />
              )}
              <div className="mt-4">
                <DayPills days={s.days_of_week} today={today} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
