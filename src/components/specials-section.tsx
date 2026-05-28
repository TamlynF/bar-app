"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";

export type SpecialRow = {
  id: number;
  title: string;
  description: string | null;
  badges: string[];
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
};

function formatDateRange(
  start: string | null,
  end: string | null
): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function SpecialsSection({ specials }: { specials: SpecialRow[] }) {
  if (specials.length === 0) return null;

  return (
    <section id="specials" className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
          Specials
        </span>
        <div className="flex-1 h-px bg-[#FDCC4B]/20" />
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-2">
        {specials.map((s) => (
          <SpecialCard key={s.id} special={s} />
        ))}
      </div>
    </section>
  );
}

function SpecialCard({ special }: { special: SpecialRow }) {
  const [flipped, setFlipped] = useState(false);
  const dateRange = formatDateRange(special.start_date, special.end_date);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="flip-card shrink-0 w-64 sm:w-72 h-32 sm:h-36 snap-start text-left cursor-pointer"
    >
      <div className={`flip-inner relative w-full h-full ${flipped ? "flipped" : ""}`}>
        {/* Front — image left, title right */}
        <div className="flip-front absolute inset-0 flex rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
          {/* Image */}
          <div className="relative w-28 sm:w-32 h-full shrink-0 bg-white/10">
            {special.image_url ? (
              <Image
                src={special.image_url}
                alt={special.title}
                fill
                className="object-cover"
                sizes="128px"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Sparkles className="w-6 h-6 text-[#FDCC4B] opacity-30" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1.5">
            <p className="text-sm font-black text-white leading-tight line-clamp-2">
              {special.title}
            </p>

            {special.badges.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {special.badges.map((b) => (
                  <span
                    key={b}
                    className="text-[8px] font-black uppercase tracking-wide text-[#FDCC4B] bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 px-1.5 py-0.5 rounded-full"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Back — description + dates */}
        <div className="flip-back absolute inset-0 flex flex-col justify-center rounded-2xl overflow-hidden border border-[#FDCC4B]/20 bg-[#26300D] p-4">
          {special.description && (
            <p className="text-xs text-stone-300 font-medium leading-snug line-clamp-3 mb-2">
              {special.description}
            </p>
          )}

          {dateRange && (
            <p className="text-[10px] text-[#FDCC4B] font-bold tabular-nums uppercase tracking-wide">
              {dateRange}
            </p>
          )}

          {!special.description && !dateRange && (
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wide text-center">
              {special.title}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
