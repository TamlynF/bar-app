import Image from "next/image";
import { MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { ArrowCta } from "@/components/ui/arrow-cta";
import type { CompanyInfo } from "@/lib/company-info";
import { summariseOpeningHours } from "@/lib/opening-hours";
import { WEEKLY_NIGHTS } from "@/lib/weekly-nights";
import { cn } from "@/lib/utils";

const NIGHT_NOTE: Record<string, string> = {
  Thu: "Quiz from 9pm",
  Fri: "Karaoke Fri",
  Sat: "Band + DJ Sat",
};

function noteFor(days: string) {
  const hits = WEEKLY_NIGHTS.filter((n) => days.includes(n.dayShort)).map((n) => NIGHT_NOTE[n.dayShort]);
  return hits.length ? hits.join(" · ") : null;
}

/* Where and when: the static map (proxied through /api/static-map so the
   key never reaches the browser), the opening hours as cards, the address,
   and the two things a phone user actually wants - directions and a call. */
export function HomeFindUs({ info, hasMap, className }: { info: CompanyInfo; hasMap: boolean; className?: string }) {
  if (!info) return null;
  const address = info.address?.trim() || null;
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const phone = info.phone?.trim() || null;
  const hours = summariseOpeningHours(info.opening_hours).map((line) => {
    const [days, ...rest] = line.split(" ");
    return { days, time: rest.join(" "), note: noteFor(days) };
  });
  const openDays = hours.map((h) => h.days).join(", ");

  return (
    <section id="find-us" aria-labelledby="find-us-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading eyebrow="See you at the bar" title="Find us" id="find-us-heading" action={{ href: "/contact", label: "Contact" }} actionOnMobile={false} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-6">
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the bar in Google Maps"
            className="relative flex min-h-42.5 items-end overflow-hidden border border-hairline bg-canvas-2 lg:col-span-7 lg:min-h-80"
          >
            {hasMap && <Image src="/api/static-map" alt="" fill sizes="(min-width: 1024px) 800px, 100vw" className="object-cover opacity-90" />}
            <span className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-[calc(50%+8px)] items-center justify-center bg-gold text-on-gold" aria-hidden="true">
              <MapPin className="h-5.5 w-5.5" />
            </span>
            <span className="relative flex w-full items-center justify-between gap-3 bg-canvas/80 px-3.5 py-3 backdrop-blur-sm">
              <span className="text-meta text-ink">{address?.split(/,|\n/)[0]}</span>
              <span className="bg-ink px-2 py-1 text-pill font-bold tracking-wide text-canvas uppercase">Open in maps</span>
            </span>
          </a>
        )}

        <div className="flex flex-col gap-2.5 lg:col-span-5">
          {hours.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 lg:gap-2.5">
              {hours.slice(0, 2).map((h) => (
                <li key={h.days} className="flex flex-col gap-1.5 border border-hairline bg-canvas-2 p-3.5 lg:p-4.5">
                  <span className="text-pill font-bold tracking-wide text-gold uppercase">{h.days}</span>
                  <span className="font-black text-btn leading-none tracking-tight text-ink uppercase tabular-nums lg:text-h3">{h.time}</span>
                  {h.note && <span className="text-meta text-ink-2">{h.note}</span>}
                </li>
              ))}
            </ul>
          )}

          {address && (
            <address className="flex flex-1 items-start gap-3 border-y border-hairline py-3.5 not-italic">
              <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ink-2" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-semibold whitespace-pre-line text-ink">{address}</span>
                {openDays && <span className="text-meta text-ink-2">Open {openDays}</span>}
              </span>
            </address>
          )}

          <div className="flex gap-2">
            {mapsHref && (
              <ArrowCta href={mapsHref} variant="gold" external className="flex-1">
                Directions
              </ArrowCta>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="flex h-11 items-center justify-center gap-2 border-2 border-ink px-4.5 text-btn font-semibold text-ink transition-colors hover:bg-ink/10 md:h-12"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
