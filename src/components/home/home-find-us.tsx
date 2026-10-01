import Image from "next/image";
import { MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import type { CompanyInfo } from "@/lib/company-info";
import { cn } from "@/lib/utils";

/* Where: the static map (proxied through /api/static-map so the key never
   reaches the browser) and the address on one line beneath it. Hours live in
   the hero's weekly strip and on /contact. */
export function HomeFindUs({ info, hasMap, className }: { info: CompanyInfo; hasMap: boolean; className?: string }) {
  if (!info) return null;
  const address = info.address?.trim() || null;
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const phone = info.phone?.trim() || null;
  const addressLine = address?.replace(/\s*\n\s*/g, ", ") ?? null;

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
          {addressLine && (
            <address className="flex items-center gap-3 border-y border-hairline py-3.5 not-italic">
              <MapPin className="h-4.5 w-4.5 shrink-0 text-gold" aria-hidden="true" />
              <span className="text-body font-semibold text-ink">{addressLine}</span>
            </address>
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
    </section>
  );
}
