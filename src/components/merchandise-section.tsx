import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { SectionHeading } from "@/components/editorial/section-heading";
import { RichTextContent } from "@/components/rich-text-content";
import { formatGBP } from "@/lib/events-display";

export type MerchandiseRow = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  display_order: number;
};

const HOMEPAGE_MERCH_LIMIT = 4;

export function MerchandiseSection({
  merchandise,
}: {
  merchandise: MerchandiseRow[];
}) {
  if (merchandise.length === 0) return null;

  const visibleItems = merchandise.slice(0, HOMEPAGE_MERCH_LIMIT);

  return (
    <section id="merchandise" className="scroll-mt-24">
      <SectionHeading eyebrow="Take it home" title="Merchandise" />

      <ul
        className="
          no-scrollbar -mx-4 flex snap-x snap-mandatory
          scroll-px-4 items-stretch gap-3.5 overflow-x-auto
          px-4 pb-3

          sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2
          sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0

          lg:grid-cols-3 lg:gap-5

          xl:grid-cols-4 xl:gap-6
        "
      >
        {visibleItems.map((item, index) => (
          <MerchandiseCard key={item.id} item={item} index={index} />
        ))}
      </ul>
    </section>
  );
}

function MerchandiseCard({
  item,
  index,
}: {
  item: MerchandiseRow;
  index: number;
}) {
  const price = item.price === null ? null : Number(item.price);

  return (
    <li
      className="
        ad-card ad-rise group relative flex
        w-[min(86vw,340px)] shrink-0 snap-start flex-col
        overflow-hidden rounded-3xl border border-hairline
        bg-canvas-2

        sm:w-auto sm:min-w-0 sm:shrink sm:snap-none
      "
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-canvas">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 340px, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag
              className="h-10 w-10 text-stone-700"
              aria-hidden="true"
            />
          </div>
        )}

        {price !== null && (
          <span className="absolute top-3 right-3 rounded-full bg-gold px-2.5 py-1 font-black text-[10px] tracking-widest text-on-gold uppercase shadow-lg shadow-black/40 tabular-nums">
            {formatGBP(price)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 font-black text-base leading-tight tracking-tight text-ink uppercase">
          {item.name}
        </h3>

        {item.description && (
          <RichTextContent
            html={item.description}
            variant="public"
            className="rich-content--md mt-2"
          />
        )}
      </div>
    </li>
  );
}
