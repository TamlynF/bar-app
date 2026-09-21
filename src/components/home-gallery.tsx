import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export type HomeGalleryItem = {
  id: number;
  title: string | null;
  image_url: string;
  media_type: string | null;
};

const MAX_SLIDES = 10;

const arrowClass =
  "static size-11 translate-y-0 border-white/15 bg-canvas-2 text-ink shadow-none hover:border-gold/60 hover:bg-canvas-2 hover:text-gold disabled:opacity-30 [&_svg]:size-4";

export function HomeGallery({ items }: { items: HomeGalleryItem[] }) {
  const slides = items.slice(0, MAX_SLIDES);
  if (slides.length === 0) return null;

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="mx-4 mt-14 scroll-mt-24 sm:mx-6 lg:mx-10"
    >
      <SectionHeading
        id="gallery-heading"
        eyebrow="The room"
        title="Inside Don Fenticas"
        action={{ href: "/gallery", label: "View gallery" }}
        actionOnMobile={false}
      />

      <Carousel
        opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
        className="-mx-4 sm:-mx-6 lg:-mx-10"
      >
        <CarouselContent
          viewportClassName="px-4 sm:px-6 lg:px-10"
          className="-ml-2.5 md:-ml-4"
        >
          {slides.map((item) => (
            <CarouselItem
              key={item.id}
              className="basis-[78%] pl-2.5 sm:basis-1/2 md:pl-4 lg:basis-1/3"
            >
              <Link
                href="/gallery"
                className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-hairline bg-canvas-2"
              >
                {item.media_type === "video" ? (
                  <video
                    src={item.image_url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                  />
                ) : (
                  <Image
                    src={item.image_url}
                    alt={item.title ?? ""}
                    fill
                    sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                )}
                <div
                  className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent"
                  aria-hidden="true"
                />
                {item.title && (
                  <span className="absolute right-3.5 bottom-3 left-3.5 line-clamp-2 font-black text-[11px] leading-tight tracking-wide text-ink uppercase">
                    {item.title}
                  </span>
                )}
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>

        <div className="mt-4 flex items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link
            href="/gallery"
            className="group inline-flex min-h-11 items-center gap-1.5 text-[11px] font-semibold text-gold sm:hidden"
          >
            View gallery
            <ArrowRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <span className="hidden text-[11px] font-semibold text-ink-2 sm:inline">
            {slides.length} {slides.length === 1 ? "shot" : "shots"}
          </span>
          <div className="flex items-center gap-2">
            <CarouselPrevious className={arrowClass} />
            <CarouselNext className={arrowClass} />
          </div>
        </div>
      </Carousel>
    </section>
  );
}
