"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sparkles, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { SpecialDetailModal } from "@/components/special-detail-modal";

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
};

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Short uppercase day tag for the stub corner, e.g. "TUE" or "FRI · SAT". */
function dayTag(days: number[]): string | null {
  if (!days || days.length === 0) return null;
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d]?.toUpperCase())
    .filter(Boolean)
    .join(" · ");
}

function shortRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

/**
 * Home "Specials" — After Dark: burgundy ticket-stubs you can tap for the full
 * details (run dates, which days it's on, terms). Burgundy flags offers per the
 * STYLE_GUIDE; the detail modal is the requested "tap for more info" flow.
 */
export function SpecialsSection({ specials }: { specials: SpecialRow[] }) {
  const [selected, setSelected] = useState<SpecialRow | null>(null);

  if (specials.length === 0) return null;

  return (
    <section id="specials" className="scroll-mt-24">
      <SectionHeading eyebrow="At the bar" title="Specials" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {specials.map((s) => (
          <SpecialStub key={s.id} special={s} onOpen={() => setSelected(s)} />
        ))}
      </div>

      {selected && (
        <SpecialDetailModal special={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function SpecialStub({
  special,
  onOpen,
}: {
  special: SpecialRow;
  onOpen: () => void;
}) {
  const tag = dayTag(special.days_of_week);
  const range = shortRange(special.start_date, special.end_date);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative text-left overflow-hidden rounded-2xl bg-[#7A1F1F] text-[#ffeede] p-5 pl-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDCC4B]"
    >
      {/* Perforated ticket edge */}
      <span
        className="ad-stub-perf absolute left-0 top-0 bottom-0 w-3.5"
        aria-hidden="true"
      />

      {tag && (
        <span className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd9b0]/80">
          {tag}
        </span>
      )}

      <Sparkles className="w-6 h-6 text-[#FDCC4B]" aria-hidden="true" />

      <h4 className="mt-3 font-black uppercase tracking-tight leading-none text-xl">
        {special.title}
      </h4>

      {range && (
        <p className="mt-2 text-[11px] font-bold tabular-nums uppercase tracking-wide text-[#ffd9b0]">
          {range}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {special.badges[0] ? (
          <span className="text-[10px] font-black uppercase tracking-wide bg-white/15 px-2.5 py-1 rounded-md">
            {special.badges[0]}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#ffd9b0]">
          View details
          <ArrowRight
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </span>
      </div>
    </button>
  );
}
