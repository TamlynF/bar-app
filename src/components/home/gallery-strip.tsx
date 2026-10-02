import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/editorial/section-heading";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { carouselArrowClass } from "@/components/home/carousel-arrows";
import { cn } from "@/lib/utils";

export type GalleryStripRow = {
  id: number;
  title: string;
  image_url: string;
};

const MAX_TILES = 6;

/* Real photos from the gallery, five across from tablet up and the same
   swipeable carousel as the merch on phones. Every tile links to the
   gallery, so the whole thing is the link, not just the action. */
export function GalleryStrip({ images, className }: { images: GalleryStripRow[]; className?: string }) {
  const tiles = images.slice(0, MAX_TILES);
  if (tiles.length === 0) return null;

  return (
    <section id="gallery" aria-labelledby="gallery-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="Photos & videos"
        title="Bar nights"
        id="gallery-heading"
        action={{ href: "/gallery", label: "View gallery" }}
        actionInline
      />

      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="-mx-4 md:hidden">
        <CarouselContent viewportClassName="px-4" className="-ml-2.5">
          {tiles.map((image) => (
            <CarouselItem key={image.id} className="basis-[62%] pl-2.5">
              <Link
                href="/gallery"
                aria-label={`${image.title} - open the gallery`}
                className="flex h-full flex-col border border-hairline bg-canvas-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="relative block aspect-square w-full bg-canvas">
                  <Image src={image.image_url} alt="" fill sizes="62vw" className="object-cover" />
                </span>
                <span className="truncate p-3 font-black text-btn leading-tight tracking-tight text-ink uppercase">
                  {image.title}
                </span>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-3 flex items-center justify-between px-4">
          <span className="text-meta font-semibold text-ink-2">
            {tiles.length} {tiles.length === 1 ? "post" : "posts"}
          </span>
          <div className="flex items-center gap-2">
            <CarouselPrevious className={carouselArrowClass} />
            <CarouselNext className={carouselArrowClass} />
          </div>
        </div>
      </Carousel>

      <ul className="hidden md:grid md:grid-cols-5 md:gap-4">
        {tiles.map((image, index) => (
          <li key={image.id} className={cn(index >= 5 && "md:hidden")}>
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
    </section>
  );
}
