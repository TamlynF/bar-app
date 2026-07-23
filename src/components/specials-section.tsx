"use client";

import { useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { Clock, FlipHorizontal2, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { RichTextContent } from "@/components/rich-text-content";
import { cn } from "@/lib/utils";

export type SpecialRow = {
  id: number;
  title: string;
  description: string | null;
  badges: string[];
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  display_order: number;
  created_at: string | null;
};

const NEW_FOR_DAYS = 7;
const ENDING_SOON_DAYS = 7;

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayTag(days: number[]): string | null {
  if (!days || days.length === 0) return null;
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d]?.toUpperCase())
    .filter(Boolean)
    .join(" · ");
}

function isRecentlyAdded(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const age = differenceInCalendarDays(new Date(), new Date(createdAt));
  return age >= 0 && age <= NEW_FOR_DAYS;
}

function endingSoonLabel(end: string | null): string | null {
  if (!end) return null;
  const days = differenceInCalendarDays(new Date(end + "T00:00:00"), new Date());
  if (days < 0 || days > ENDING_SOON_DAYS) return null;
  if (days === 0) return "Last day";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

function dayPills(days: number[]): string[] {
  const list = [...(days ?? [])].sort((a, b) => a - b);
  if (list.length === 0 || list.length >= 7) return ["Every day"];
  return list.map((d) => DAY_LABELS[d]).filter(Boolean);
}

function shortRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function SpecialsSection({ specials }: { specials: SpecialRow[] }) {
  const [flippedId, setFlippedId] = useState<number | null>(null);

  if (specials.length === 0) return null;

  return (
    <section id="specials" className="scroll-mt-24">
      <SectionHeading eyebrow="At the bar" title="Specials" />

      <div className="rail-scrollbar snap-x snap-mandatory overflow-x-auto pb-4">
        <div className="flex w-max items-start gap-3.5">
          {specials.map((s) => (
            <SpecialStub
              key={s.id}
              special={s}
              flipped={flippedId === s.id}
              onToggle={() => setFlippedId((id) => (id === s.id ? null : s.id))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SpecialStub({
  special,
  flipped,
  onToggle,
}: {
  special: SpecialRow;
  flipped: boolean;
  onToggle: () => void;
}) {
  const tag = dayTag(special.days_of_week);
  const range = shortRange(special.start_date, special.end_date);
  const pills = dayPills(special.days_of_week);
  const isNew = isRecentlyAdded(special.created_at);
  const endingSoon = endingSoonLabel(special.end_date);
  const badges = isNew
    ? special.badges.filter((b) => b.trim().toLowerCase() !== "new")
    : special.badges;
  const backId = `special-${special.id}-details`;

  return (
    <div className="w-60 shrink-0 snap-start perspective-[1600px] sm:w-64 lg:w-72">
      <div
        className={cn(
          "relative transform-3d transition-transform duration-500",
          flipped && "rotate-y-180"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={flipped}
          aria-controls={backId}
          aria-label={`${special.title} — show details`}
          tabIndex={flipped ? -1 : 0}
          className={cn(
            "group flex h-44 w-full flex-col overflow-hidden rounded-3xl bg-[#7A1F1F] p-4 text-left text-[#ffeede] shadow-lg shadow-black/30 backface-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-black/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDCC4B] sm:p-5",
            flipped ? "absolute inset-0" : "relative"
          )}
        >
          {special.image_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={special.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 bg-[#7A1F1F]/45 mix-blend-multiply"
                aria-hidden="true"
              />
              <span
                className="absolute inset-0 bg-linear-to-t from-black/95 via-black/75 to-black/55"
                aria-hidden="true"
              />
            </>
          )}

          {(isNew || endingSoon) && (
            <span className="absolute top-0 left-0 z-20 flex items-stretch overflow-hidden rounded-tl-3xl rounded-br-xl shadow-md shadow-black/30">
              {isNew && (
                <span className="flex items-center gap-1 bg-[#FDCC4B] px-3 py-1 font-black text-[10px] tracking-widest text-[#1a2008] uppercase">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  New
                </span>
              )}
              {endingSoon && (
                <span className="flex items-center gap-1 bg-[#FF6B35] px-3 py-1 font-black text-[10px] tracking-widest text-[#1a2008] uppercase">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {endingSoon}
                </span>
              )}
            </span>
          )}

          <span className="relative z-10 grid h-full grid-rows-5 items-center">
            <span aria-hidden="true">
              {tag && (
                <span className="block text-right font-black text-[10px] tracking-[0.12em] text-[#ffd9b0]/90 uppercase">
                  {tag}
                </span>
              )}
            </span>

            <span className="line-clamp-1 block font-black text-xl leading-none tracking-tight text-white uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              {special.title}
            </span>

            <span className="block text-[11px] font-bold tracking-wide text-[#ffd9b0] uppercase tabular-nums drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {range}
            </span>

            <span className="flex flex-wrap items-center gap-1.5 overflow-hidden">
              {badges.map((b) => (
                <span
                  key={b}
                  className="rounded-md bg-white/15 px-2.5 py-1 font-black text-[10px] tracking-wide uppercase"
                >
                  {b}
                </span>
              ))}
            </span>

            <span className="flex items-end justify-end self-end">
              <FlipHorizontal2
                className="h-5 w-5 text-[#FDCC4B] transition-transform duration-300 group-hover:rotate-y-180"
                aria-hidden="true"
              />
            </span>
          </span>
        </button>

        <div
          id={backId}
          aria-hidden={!flipped}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-3xl bg-[#1b210f] p-4 text-left text-[#ffeede] shadow-lg shadow-black/30 backface-hidden rotate-y-180 sm:p-5",
            flipped ? "relative" : "absolute inset-0"
          )}
        >
          {special.image_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={special.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-20"
              />
              <span className="absolute inset-0 bg-[#1b210f]/70" aria-hidden="true" />
            </>
          )}

          <div className="relative z-10 flex flex-1 flex-col">
            <h4 className="font-black text-xl leading-none tracking-tight text-[#ffd9b0] uppercase">
              {special.title}
            </h4>

            {special.description && (
              <RichTextContent
                html={special.description}
                variant="public"
                className="rich-content--lg mt-3"
              />
            )}

            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 font-black text-[10px] tracking-[0.16em] text-[#ffd9b0]/70 uppercase">
                Available on
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pills.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-[#FDCC4B]/30 bg-[#FDCC4B]/12 px-2.5 py-1 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase"
                  >
                    {p}
                  </span>
                ))}
              </div>

              {range && (
                <p className="mt-2.5 text-[11px] font-bold tracking-wide text-[#ffd9b0]/70 uppercase tabular-nums">
                  {range}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onToggle}
              tabIndex={flipped ? 0 : -1}
              aria-label={`${special.title} — hide details`}
              className="group/back mt-3 flex items-center justify-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDCC4B]"
            >
              <FlipHorizontal2
                className="h-5 w-5 text-[#FDCC4B] transition-transform duration-300 group-hover/back:rotate-y-180"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
