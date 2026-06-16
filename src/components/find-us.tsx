import Link from "next/link";
import { MapPin, Clock, Instagram, Facebook, ArrowRight } from "lucide-react";

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DayHours = { open?: string; close?: string };
type OpeningHours = Partial<Record<string, DayHours>>;

export type CompanyInfo = {
  address?: string | null;
  opening_hours?: OpeningHours | null;
  instagram?: string | null;
  facebook?: string | null;
} | null;

/**
 * Compact "Find us" card for the home page: today's opening hours, address, a
 * couple of social links and a route through to the full Contact page. Renders
 * nothing if there's no company information at all.
 */
export function FindUs({ info }: { info: CompanyInfo }) {
  if (!info) return null;

  const hours = (info.opening_hours ?? {}) as OpeningHours;
  const todayName = new Date()
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();
  const todayHours = hours[todayName];
  const openToday = Boolean(todayHours?.open && todayHours?.close);

  const hasAnyHours = DAYS.some((d) => hours[d]?.open);
  const ig = info.instagram?.replace("@", "");
  const fb = info.facebook;

  if (!info.address && !hasAnyHours && !ig && !fb) return null;

  const mapsHref = info.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`
    : null;

  return (
    <section>
      <span className="text-xs font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
        Find Us
      </span>

      <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        {hasAnyHours && (
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#FDCC4B]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em]">
                Today
              </p>
              {openToday ? (
                <p className="text-white text-sm font-black tabular-nums">
                  {todayHours!.open} &ndash; {todayHours!.close}
                </p>
              ) : (
                <p className="text-stone-400 text-sm font-bold">Closed today</p>
              )}
            </div>
          </div>
        )}

        {info.address && (
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FDCC4B]/10 border border-[#FDCC4B]/20 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#FDCC4B]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em]">
                Address
              </p>
              <p className="text-white text-sm font-bold whitespace-pre-line">
                {info.address}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
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
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 text-[11px] font-black uppercase tracking-wide transition-colors"
            >
              Directions
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
    </section>
  );
}
