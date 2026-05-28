"use client";

import { useState } from "react";
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
    <section id="specials" className="max-w-5xl mx-auto px-4 sm:px-6 pb-4 sm:pb-14">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
          Specials
        </span>
        <div className="flex-1 h-px bg-[#FDCC4B]/20" />
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4">
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
      className="shrink-0 snap-start w-48 sm:w-56 h-20 sm:h-24 rounded-2xl border border-white/10 bg-[#26300D] overflow-hidden text-left cursor-pointer"
    >
      {!flipped ? (
        /* Front — circle thumbnail + info */
        <div className="flex h-full gap-2.5 p-2 items-center animate-in fade-in duration-200">
          {/* Image — circle */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full overflow-hidden border border-white/10 bg-white/5">
            {special.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={special.image_url}
                alt={special.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Sparkles className="w-5 h-5 text-[#FDCC4B] opacity-30" />
              </div>
            )}
          </div>

          {/* Info — two thirds */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
            <p className="text-sm font-black text-white leading-tight line-clamp-2">
              {special.title}
            </p>

            {dateRange && (
              <p className="text-[10px] text-[#FDCC4B] font-bold tabular-nums uppercase tracking-wide">
                {dateRange}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Back — description + badges */
        <div className="flex flex-col justify-center h-full p-3 animate-in fade-in duration-200 gap-1.5">
          {special.description && (
            <p className="text-[10px] text-stone-300 font-medium leading-snug line-clamp-2">
              {special.description}
            </p>
          )}

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

          {!special.description && special.badges.length === 0 && (
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wide text-center">
              {special.title}
            </p>
          )}
        </div>
      )}
    </button>
  );
}
