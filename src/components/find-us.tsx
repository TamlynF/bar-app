import Link from "next/link";
import { MapPin, Instagram, Facebook, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

type DayHours = { open?: string; close?: string };
type OpeningHours = Partial<Record<string, DayHours>>;

export type CompanyInfo = {
  address?: string | null;
  opening_hours?: OpeningHours | null;
  instagram?: string | null;
  facebook?: string | null;
} | null;

/**
 * Home "Find Us" — After Dark: a two-column block with the address + socials on
 * the left and the full week's opening hours on the right. Today's row is
 * marked in gold. Renders nothing when there's no company information.
 */
export function FindUs({ info }: { info: CompanyInfo }) {
  if (!info) return null;

  const hours = (info.opening_hours ?? {}) as OpeningHours;
  const todayKey = new Date()
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();

  const hasAnyHours = DAYS.some((d) => hours[d.key]?.open);
  const ig = info.instagram?.replace("@", "");
  const fb = info.facebook;

  if (!info.address && !hasAnyHours && !ig && !fb) return null;

  const mapsHref = info.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`
    : null;

  return (
    <section id="find-us" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Find us"
        title="Get Down Here"
        action={{ href: "/contact", label: "Contact" }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Left — address + socials */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          {info.address && (
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#FDCC4B]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  Address
                </p>
                <p className="text-white text-sm font-bold whitespace-pre-line mt-0.5">
                  {info.address}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-5">
            {ig && (
              <a
                href={`https://instagram.com/${ig}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Instagram className="w-5 h-5" aria-hidden="true" />
              </a>
            )}
            {fb && (
              <a
                href={fb.startsWith("http") ? fb : `https://facebook.com/${fb}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Facebook className="w-5 h-5" aria-hidden="true" />
              </a>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-[#FDCC4B] text-[#1a2008] text-[11px] font-black uppercase tracking-wide hover:bg-[#e5b843] active:scale-95 transition-all"
              >
                Directions
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 text-[11px] font-black uppercase tracking-wide transition-colors ml-auto"
            >
              Contact
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Right — opening hours */}
        {hasAnyHours ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-2">
            {DAYS.map((d) => {
              const h = hours[d.key];
              const open = Boolean(h?.open && h?.close);
              const isToday = d.key === todayKey;
              return (
                <div
                  key={d.key}
                  className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0"
                >
                  <span
                    className={
                      isToday
                        ? "text-[#FDCC4B] text-[13px] font-black uppercase tracking-wide"
                        : "text-white text-[13px] font-bold uppercase tracking-wide"
                    }
                  >
                    {d.label}
                  </span>
                  <span className="flex-1 border-b border-dotted border-white/10 self-end mb-1.5" />
                  <span
                    className={
                      open
                        ? "text-stone-300 text-[13px] font-bold tabular-nums"
                        : "text-stone-500 text-[13px] font-bold"
                    }
                  >
                    {open ? `${h!.open} – ${h!.close}` : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center">
            <p className="text-stone-400 text-sm font-medium">
              Opening hours coming soon — give us a call or check our socials.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
