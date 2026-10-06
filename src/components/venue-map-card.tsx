import Image from "next/image";
import { ExternalLink } from "lucide-react";
import CopyAddressButton from "@/app/(public)/contact/_components/copy-address-button";
import { DfMapPin } from "@/components/df-map-pin";
import { cn } from "@/lib/utils";

/* The map and address card on the home page and /contact. The map is the
   cached static image from /api/static-map with the DF pin over its centre,
   and the whole map opens Google Maps. Without a Maps key it falls back to
   Google's embed, which can't take a custom pin. */
export function VenueMapCard({
  address,
  hasMap,
  className,
}: {
  address: string;
  hasMap: boolean;
  className?: string;
}) {
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-white/5", className)}>
      {hasMap ? (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the bar in Google Maps"
          className="group relative block h-56 overflow-hidden bg-canvas-2 sm:h-64 lg:h-80"
        >
          {/* Google's map is 1280px wide, so no screen is offered more than the 1200px version. */}
          <Image src="/api/static-map" alt="" fill sizes="(min-width: 640px) 600px, 390px" className="object-cover opacity-90" />
          <DfMapPin />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-ink px-2.5 py-1.5 text-pill font-bold tracking-wide text-canvas uppercase transition-colors group-hover:bg-gold">
            Open in maps
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </a>
      ) : (
        <iframe
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed`}
          title={`Map showing Don Fenticas at ${address}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-56 w-full border-0 sm:h-64"
        />
      )}
      <div className="flex items-start gap-3 border-t border-white/10 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-pill font-bold tracking-wide text-ink-2 uppercase">Address</p>
          <address className="mt-1 text-body font-semibold whitespace-pre-line text-ink not-italic select-all">
            {address}
          </address>
        </div>
        <CopyAddressButton address={address} />
      </div>
    </div>
  );
}
