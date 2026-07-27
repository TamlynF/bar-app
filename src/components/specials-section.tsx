import { SectionHeading } from "@/components/editorial/section-heading";
import { RichTextContent } from "@/components/rich-text-content";

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

const HOMEPAGE_SPECIAL_LIMIT = 4;

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayPills(days: number[]): string[] {
  const list = [...(days ?? [])].sort((a, b) => a - b);

  if (list.length === 0 || list.length >= 7) {
    return ["All week"];
  }

  return list.map((day) => DAY_LABELS[day]).filter(Boolean);
}

export function SpecialsSection({ specials }: { specials: SpecialRow[] }) {
  if (specials.length === 0) {
    return null;
  }

  const visibleSpecials = specials.slice(0, HOMEPAGE_SPECIAL_LIMIT);

  const trackCount = {
    "--specials-cols-sm": String(Math.min(visibleSpecials.length, 2)),
    "--specials-cols-xl": String(Math.min(visibleSpecials.length, 4)),
  } as React.CSSProperties;

  return (
    <section id="specials" className="scroll-mt-24">
      <SectionHeading
        eyebrow="At the bar"
        title="Specials"
        action={{ href: "/menu", label: "See the menu" }}
      />

      <ul
        style={trackCount}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:auto-rows-fr sm:grid-cols-[repeat(var(--specials-cols-sm),minmax(0,20rem))] sm:justify-center sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-[repeat(var(--specials-cols-xl),minmax(0,20rem))] xl:gap-8"
      >
        {visibleSpecials.map((special) => (
          <SpecialStub key={special.id} special={special} />
        ))}
      </ul>
    </section>
  );
}

function SpecialStub({ special }: { special: SpecialRow }) {
  const pills = dayPills(special.days_of_week);

  return (
    <li className="h-full w-[min(86vw,340px)] shrink-0 snap-start sm:w-auto sm:snap-none">
      <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-[#7A1F1F]/45 bg-[#241512] text-[#ffeede] shadow-lg shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:border-[#7A1F1F]/80 hover:shadow-2xl hover:shadow-black/50">
        {special.image_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={special.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
            />

            <span
              className="absolute inset-0 bg-linear-to-b from-[#241512]/55 via-[#241512]/88 to-[#241512]"
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative z-10 flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 min-h-10 text-center font-black text-xl leading-none tracking-tight text-[#ffd9b0] uppercase">
            {special.title}
          </h3>

          {special.description && (
            <RichTextContent
              html={special.description}
              variant="public"
              className="rich-content--md mt-2"
            />
          )}

          <div className="mt-auto pt-4">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-[#FDCC4B]/30 bg-[#FDCC4B]/10 px-2.5 py-1 font-black text-[10px] tracking-widest text-[#FDCC4B] uppercase"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
