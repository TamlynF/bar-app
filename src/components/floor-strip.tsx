import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import type { PromoRow } from "@/components/instagram-strip";
import type { MerchandiseRow } from "@/components/merchandise-section";
import { instagramUrl } from "@/lib/company-info";
import { MerchRail } from "@/components/merch-rail";

const FLOOR_TILES = 4;
const MERCH_TILES = 8;

/* "From the floor": four recent posts and the way to Instagram, beside
   "Take a little noise home": the merch rail. One row on tablet/desktop;
   phones stack them with the merch rail first, straight after Specials. */
export function FloorStrip({
  posts,
  merchandise,
  instagram,
}: {
  posts: PromoRow[];
  merchandise: MerchandiseRow[];
  instagram: string | null;
}) {
  const tiles = posts.slice(0, FLOOR_TILES);
  const merch = merchandise.slice(0, MERCH_TILES);
  const igHref = instagramUrl(instagram) ?? "/gallery";
  if (tiles.length === 0 && merch.length === 0) return null;

  return (
    <div className="mx-4 mt-6 flex flex-col gap-6 sm:mx-6 md:mt-5 md:gap-5 lg:mx-10">
      {tiles.length > 0 && (
        <section id="instagram" aria-labelledby="floor-heading" className="md:flex md:items-center md:gap-5 md:rounded-[20px] md:border md:border-ink/15 md:bg-canvas-2 md:p-5">
          <div className="flex items-end justify-between gap-3 md:w-42.5 md:shrink-0 md:flex-col md:items-start md:justify-start">
            <div>
              <h2 id="floor-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase md:text-[28px] md:leading-[0.95]">
                From the floor
              </h2>
              <p className="mt-1.5 text-[11px] font-semibold text-ink-2 md:mt-2.5 md:text-xs md:leading-snug md:text-gold">
                Real nights.<span className="hidden md:inline"><br /></span> Real people.
              </p>
            </div>
            {igHref.startsWith("http") ? (
              <a
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Don Fenticas on Instagram"
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full pr-4 pl-3 font-black text-[10px] tracking-[0.18em] uppercase shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95 md:mt-3 md:self-start ${SOCIAL_BRANDS.instagram.solid}`}
              >
                <SiInstagram className="h-4 w-4 shrink-0" aria-hidden="true" />
                Follow
              </a>
            ) : (
              <a
                href={igHref}
                className="group inline-flex min-h-11 items-center gap-1.5 font-black text-[9px] tracking-[0.16em] text-gold uppercase md:mt-3 md:min-h-0 md:text-[10px] md:text-ink"
              >
                View gallery
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            )}
          </div>
          <ul className="m-0 mt-3 grid list-none grid-cols-4 gap-1.5 p-0 md:mt-0 md:flex-1 md:gap-2.5">
            {tiles.map((post) => {
              const href = post.external_url || igHref;
              return (
                <li key={post.id} className="relative aspect-square overflow-hidden rounded-[10px] border border-ink/15 bg-canvas-2 md:aspect-auto md:h-32 md:rounded-xl">
                  <a href={href} target="_blank" rel="noopener noreferrer" className="group absolute inset-0 block" aria-label={post.title}>
                    {post.media_type === "video" ? (
                      <video src={post.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-hidden="true" />
                    ) : (
                      <Image src={post.media_url} alt="" fill sizes="(max-width: 768px) 25vw, 160px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {merch.length > 0 && (
        <section id="merchandise" aria-labelledby="merch-heading" className="overflow-hidden rounded-2xl border border-ink/15 bg-canvas-2 p-4 max-md:order-first md:flex md:items-center md:gap-4 md:rounded-[20px] md:p-5">
          <div className="flex items-end justify-between gap-3 md:w-60 md:shrink-0 md:flex-col md:items-start">
            <div>
              <h2 id="merch-heading" className="m-0 font-black text-[22px] leading-none tracking-tighter text-ink uppercase md:text-[28px] md:leading-[0.95]">
                Take a little noise home
              </h2>
              <p className="mt-1.5 text-[11px] font-semibold text-ink-2 md:mt-2.5 md:text-xs md:leading-snug md:text-gold">
                Available<span className="hidden md:inline"><br /></span> at the bar.
              </p>
            </div>
            <span className="shrink-0 font-black text-[9px] tracking-[0.16em] text-ink-2 uppercase md:mt-3">
              {merchandise.length} {merchandise.length === 1 ? "item" : "items"}
            </span>
          </div>
          <MerchRail merchandise={merch} />
        </section>
      )}
    </div>
  );
}
