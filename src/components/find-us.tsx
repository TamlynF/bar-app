import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { SiInstagram, SiFacebook } from "react-icons/si";
import { SectionHeading } from "@/components/editorial/section-heading";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import type { CompanyInfo, OpeningHours } from "@/lib/company-info";

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export type { CompanyInfo };

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

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-canvas-2 p-5">
          {info.address && (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FDCC4B]/20 bg-[#FDCC4B]/10">
                <MapPin className="h-4 w-4 text-[#FDCC4B]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-[10px] tracking-[0.2em] text-stone-500 uppercase">
                  Address
                </p>
                <p className="mt-0.5 text-sm font-bold whitespace-pre-line text-ink">
                  {info.address}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {ig && (
              <a
                href={`https://instagram.com/${ig}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 ${SOCIAL_BRANDS.instagram.solid}`}
              >
                <SiInstagram className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            {fb && (
              <a
                href={fb.startsWith("http") ? fb : `https://facebook.com/${fb}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 ${SOCIAL_BRANDS.facebook.solid}`}
              >
                <SiFacebook className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#FDCC4B] px-4 font-black text-[11px] tracking-wide text-[#1a2008] uppercase transition-all hover:bg-[#e5b843] active:scale-95"
              >
                Directions
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            <Link
              href="/contact"
              className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-xl border border-hairline bg-canvas-2 px-4 font-black text-[11px] tracking-wide text-ink-2 uppercase transition-colors hover:bg-white/10 hover:text-ink"
            >
              Contact
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {hasAnyHours ? (
          <div className="rounded-2xl border border-hairline bg-canvas-2 px-5 py-2">
            {DAYS.map((d) => {
              const h = hours[d.key];
              const open = Boolean(h?.open && h?.close);
              const isToday = d.key === todayKey;
              return (
                <div
                  key={d.key}
                  className="flex items-center gap-3 border-b border-hairline py-3 last:border-0"
                >
                  <span
                    className={
                      isToday
                        ? "font-black text-[13px] tracking-wide text-[#FDCC4B] uppercase"
                        : "text-[13px] font-bold tracking-wide text-ink uppercase"
                    }
                  >
                    {d.label}
                  </span>
                  <span className="mb-1.5 flex-1 self-end border-b border-dotted border-hairline" />
                  <span
                    className={
                      open
                        ? "text-[13px] font-bold text-ink-2 tabular-nums"
                        : "text-[13px] font-bold text-stone-500"
                    }
                  >
                    {open ? `${h!.open} – ${h!.close}` : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center rounded-2xl border border-hairline bg-canvas-2 p-5">
            <p className="text-sm font-medium text-stone-400">
              Opening hours coming soon - give us a call or check our socials.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
