import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/editorial/section-heading";
import { ArrowCta } from "@/components/ui/arrow-cta";
import { cn } from "@/lib/utils";

export type GalleryStripRow = {
  id: number;
  title: string;
  image_url: string;
};

const MAX_TILES = 6;

/* Real photos from the gallery, five across from tablet up and a swipeable
   row on phones. Every tile links to the gallery: with no hamburger on phones
   this section is the way there, so the whole thing is the link, not just
   the action. */
export function GalleryStrip({ images, className }: { images: GalleryStripRow[]; className?: string }) {
  const tiles = images.slice(0, MAX_TILES);
  if (tiles.length === 0) return null;

  return (
    <section id="gallery" aria-labelledby="gallery-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="From the floor"
        title="Real nights, real people"
        id="gallery-heading"
        action={{ href: "/gallery", label: "Gallery" }}
        actionOnMobile={false}
      />

      <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
        {tiles.map((image, index) => (
          <li
            key={image.id}
            className={cn(
              "w-[62%] shrink-0 snap-start md:w-auto",
              index >= 5 && "md:hidden"
            )}
          >
            <Link
              href="/gallery"
              aria-label={`${image.title} - open the gallery`}
              className="group relative block aspect-square overflow-hidden rounded-xl border border-hairline bg-canvas-2 transition-transform active:scale-[0.98]"
            >
              <Image
                src={image.image_url}
                alt=""
                fill
                sizes="(min-width: 768px) 20vw, 62vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="pointer-events-none absolute inset-0 bg-linear-to-t from-canvas/70 via-transparent to-transparent"
                aria-hidden="true"
              />
              <span className="absolute right-3 bottom-2.5 left-3 truncate text-meta font-semibold text-ink">
                {image.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ArrowCta href="/gallery" variant="goldOutline" className="mt-4 w-full sm:hidden">
        See the gallery
      </ArrowCta>
    </section>
  );
}
