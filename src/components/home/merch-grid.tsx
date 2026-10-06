"use client";

import Image from "next/image";
import { Shirt, Store } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { MerchandiseRow } from "@/components/merchandise-section";
import { formatGBP } from "@/lib/events-display";
import { cn } from "@/lib/utils";
import { carouselArrowClass } from "@/components/home/carousel-arrows";

const MAX_ITEMS = 8;

function MerchCard({ item }: { item: MerchandiseRow }) {
  return (
    <div className="flex h-full flex-col border border-hairline bg-canvas-2">
      <div className="relative aspect-square w-full bg-canvas lg:aspect-4/3">
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill sizes="(min-width: 1024px) 320px, 62vw" className="object-cover" />
        ) : (
          <Shirt className="absolute inset-0 m-auto h-8 w-8 text-ink-2" aria-hidden="true" />
        )}
        {item.price != null && (
          <span className="absolute top-2.5 right-2.5 bg-gold px-1.5 py-1 text-pill font-bold tracking-wide text-on-gold uppercase tabular-nums">
            {formatGBP(item.price)}
          </span>
        )}
      </div>
      <h3 className="p-3 font-black text-btn leading-tight tracking-tight text-ink uppercase lg:p-4 lg:text-h3">{item.name}</h3>
    </div>
  );
}

/* Branded goods: a swipeable carousel on phones, a four-across grid from
   tablet up, the price stamped on each photo. Display only: the note
   underneath says they are sold at the bar. */
export function MerchGrid({ items, className }: { items: MerchandiseRow[]; className?: string }) {
  const goods = items.slice(0, MAX_ITEMS);
  if (goods.length === 0) return null;

  return (
    <section id="merch" aria-labelledby="merch-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="Take a little noise home"
        title="DF merch"
        id="merch-heading"
        note={
          <>
            <Store className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            Sold at the bar
          </>
        }
      />

      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="-mx-4 md:hidden">
        <CarouselContent viewportClassName="px-4" className="-ml-2.5">
          {goods.map((item) => (
            <CarouselItem key={item.id} className="basis-[62%] pl-2.5">
              <MerchCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-3 flex items-center justify-between px-4">
          <span className="text-meta font-semibold text-ink-2">
            {goods.length} {goods.length === 1 ? "item" : "items"}
          </span>
          <div className="flex items-center gap-2">
            <CarouselPrevious className={carouselArrowClass} />
            <CarouselNext className={carouselArrowClass} />
          </div>
        </div>
      </Carousel>

      <ul className="hidden gap-4 md:grid md:grid-cols-4">
        {goods.slice(0, 4).map((item) => (
          <li key={item.id}>
            <MerchCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
