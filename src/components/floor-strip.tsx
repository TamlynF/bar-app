import Image from "next/image";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import type { PromoRow } from "@/components/instagram-strip";
import type { MerchandiseRow } from "@/components/merchandise-section";
import { instagramUrl } from "@/lib/company-info";
import { formatGBP } from "@/lib/events-display";

const FLOOR_TILES = 4;
const MERCH_TILES = 8;

/* "From the floor": four recent posts and the way to Instagram, beside
   "Take a little noise home": the first two pieces of merch. One row on
   tablet/desktop, stacked on phones. */
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
        <section id="merchandise" aria-labelledby="merch-heading" className="overflow-hidden rounded-2xl border border-ink/15 bg-canvas-2 p-4 md:flex md:items-center md:gap-4 md:rounded-[20px] md:p-5">
          <div className="flex items-end justify-between gap-3 md:w-60 md:shrink-0 md:flex-col md:items-start">
            <div>
              <h2 id="merch-heading" className="m-0 font-black text-xl leading-none tracking-tighter text-ink uppercase md:text-[28px] md:leading-[0.95]">
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
          <ul className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory list-none gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 md:mx-0 md:mt-0 md:min-w-0 md:flex-1 md:gap-4 md:scroll-px-0 md:px-0">
            {merch.map((item) => {
              const price = item.price == null ? null : Number(item.price);
              return (
                <li key={item.id} className="w-28 shrink-0 snap-start md:w-40">
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-ink/15 bg-[radial-gradient(70%_60%_at_50%_35%,#2a2f1c,#14180a)] text-ink">
                    {item.image_url ? (
                      <Image src={item.image_url} alt="" fill sizes="(max-width: 768px) 112px, 160px" className="object-cover" />
                    ) : (
                      <ShoppingBag className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2" strokeWidth={1.6} aria-hidden="true" />
                    )}
                    {price !== null && (
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-gold px-1.5 py-0.5 font-black text-[9px] tracking-wide text-on-gold tabular-nums shadow-md shadow-black/40">
                        {formatGBP(price)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 font-black text-[10px] leading-tight tracking-wide text-ink uppercase md:text-xs">{item.name}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
