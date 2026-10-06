import { Phone } from "lucide-react";
import { VenueMapCard } from "@/components/venue-map-card";
import { SectionHeading } from "@/components/editorial/section-heading";
import type { CompanyInfo } from "@/lib/company-info";
import { cn } from "@/lib/utils";

/* Where: the static map (proxied through /api/static-map so the key never
   reaches the browser) with the address and a copy button beneath it, the same
   card as the contact page. Hours live in
   the hero's weekly strip and on /contact. */
export function HomeFindUs({ info, hasMap, className }: { info: CompanyInfo; hasMap: boolean; className?: string }) {
  if (!info) return null;
  const address = info.address?.trim() || null;
  const phone = info.phone?.trim() || null;

  return (
    <section id="find-us" aria-labelledby="find-us-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading eyebrow="See you at the bar" title="Find us" id="find-us-heading" action={{ href: "/contact", label: "Contact" }} actionOnMobile={false} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-6">
        {address && <VenueMapCard address={address} hasMap={hasMap} className="lg:col-span-7" />}

        <div className="flex flex-col gap-2.5 lg:col-span-5">
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
