import { SectionHeading } from "@/components/editorial/section-heading";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { carouselArrowClass } from "@/components/home/carousel-arrows";
import { CategoryCard } from "@/components/gallery/category-tile";
import type { GalleryGroup } from "@/lib/gallery-categories";
import { cn } from "@/lib/utils";

const MAX_TILES = 6;

/* One tile per gallery category, five across from tablet up and the same
   swipeable carousel as the merch on phones. A tile opens that category's
   page; "View all" opens the whole gallery. */
export function GalleryStrip({ groups, className }: { groups: GalleryGroup[]; className?: string }) {
  const tiles = groups.slice(0, MAX_TILES);
  if (tiles.length === 0) return null;

  return (
    <section id="gallery" aria-labelledby="gallery-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="Photos & videos"
        title="Gallery"
        id="gallery-heading"
        action={{ href: "/gallery", label: "View all" }}
        actionInline
      />

      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="-mx-4 md:hidden">
        <CarouselContent viewportClassName="px-4" className="-ml-2.5">
          {tiles.map((group) => (
            <CarouselItem key={group.slug} className="basis-[62%] pl-2.5">
              <CategoryCard group={group} sizes="62vw" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-3 flex items-center justify-between px-4">
          <span className="text-meta font-semibold text-ink-2">
            {tiles.length} {tiles.length === 1 ? "category" : "categories"}
          </span>
          <div className="flex items-center gap-2">
            <CarouselPrevious className={carouselArrowClass} />
            <CarouselNext className={carouselArrowClass} />
          </div>
        </div>
      </Carousel>

      <ul className="hidden md:grid md:grid-cols-5 md:gap-4">
        {tiles.map((group, index) => (
          <li key={group.slug} className={cn(index >= 5 && "md:hidden")}>
            <CategoryCard group={group} sizes="(min-width: 768px) 20vw, 62vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
