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
  if (list.length === 0 || list.length >= 7) return ["All week"];
  return list.map((d) => DAY_LABELS[d]).filter(Boolean);
}

function shortRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

function plainText(html: string | null): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

export function SpecialsSection({ specials }: { specials: SpecialRow[] }) {
  const [flippedId, setFlippedId] = useState<number | null>(null);

  if (specials.length === 0) return null;

  return (
    <section id="specials" className="scroll-mt-24">
      <SectionHeading
        eyebrow="At the bar"
        title="Specials"
        action={{ href: "/menu", label: "See the menu" }}
      />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specials.map((s) => (
          <SpecialStub
            key={s.id}
            special={s}
            flipped={flippedId === s.id}
            onToggle={() => setFlippedId((id) => (id === s.id ? null : s.id))}
          />
        ))}
      </ul>
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
  const range = shortRange(special.start_date, special.end_date);
  const pills = dayPills(special.days_of_week);
  const isNew = isRecentlyAdded(special.created_at);
  const endingSoon = endingSoonLabel(special.end_date);
  const teaser = plainText(special.description);
  const badges = isNew
    ? special.badges.filter((b) => b.trim().toLowerCase() !== "new")
    : special.badges;
  const backId = `special-${special.id}-details`;

  return (
    <li className="perspective-[1600px]">
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
            "group flex w-full flex-col overflow-hidden rounded-3xl border border-[#7A1F1F]/45 bg-[#241512] text-left text-[#ffeede] shadow-lg shadow-black/30 backface-hidden transition-shadow duration-300 hover:border-[#7A1F1F]/70 hover:shadow-2xl hover:shadow-black/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDCC4B]",
            flipped ? "absolute inset-0" : "relative"
          )}
        >
          {special.image_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={special.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-15 transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 bg-[#241512]/80"
                aria-hidden="true"
              />
            </>
          )}

          <div className="relative z-10 flex flex-1 flex-col p-5">
            {(isNew || endingSoon) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {isNew && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FDCC4B] px-2.5 py-1 font-black text-[10px] tracking-widest text-[#1a2008] uppercase">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    New
                  </span>
                )}
                {endingSoon && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-2.5 py-1 font-black text-[10px] tracking-widest text-[#FF6B35] uppercase">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {endingSoon}
                  </span>
                )}
              </div>
            )}

            <h3 className="line-clamp-1 font-black text-xl leading-none tracking-tight text-white uppercase">
              {special.title}
            </h3>

            {teaser && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed font-medium text-[#ffd9b0]/70">
                {teaser}
              </p>
            )}

            {range && (
              <p className="mt-2.5 text-[11px] font-bold tracking-wide text-[#FDCC4B] uppercase tabular-nums">
                {range}
              </p>
            )}

            <div
              className="relative mt-4 mb-3.5 border-t border-dashed border-white/15"
              aria-hidden="true"
            >
              <span className="absolute top-0 -left-5 h-4 w-4 -translate-y-1/2 rounded-full bg-canvas" />
              <span className="absolute top-0 -right-5 h-4 w-4 -translate-y-1/2 rounded-full bg-canvas" />
            </div>

            <div className="mt-auto flex items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {pills.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-[#FDCC4B]/30 bg-[#FDCC4B]/10 px-2.5 py-1 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase"
                  >
                    {p}
                  </span>
                ))}
                {badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-black text-[10px] tracking-widest uppercase"
                  >
                    {b}
                  </span>
                ))}
              </div>

              <FlipHorizontal2
                className="h-5 w-5 shrink-0 text-[#FDCC4B] transition-transform duration-300 group-hover:rotate-y-180"
                aria-hidden="true"
              />
            </div>
          </div>
        </button>

        <div
          id={backId}
          aria-hidden={!flipped}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-3xl border border-[#7A1F1F]/45 bg-[#1b0f0c] p-5 text-left text-[#ffeede] shadow-lg shadow-black/30 backface-hidden rotate-y-180",
            flipped ? "relative" : "absolute inset-0"
          )}
        >
          {special.image_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={special.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-15"
              />
              <span className="absolute inset-0 bg-[#1b0f0c]/80" aria-hidden="true" />
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
    </li>
  );
}
