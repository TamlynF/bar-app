import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type GalleryPeekItem = {
  id: number;
  title: string | null;
  image_url: string;
};

/**
 * A horizontal strip of recent gallery photos on the home page, linking to the
 * full /gallery. Renders nothing when there are no photos to show.
 */
export function GalleryPeek({ items }: { items: GalleryPeekItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-xs font-black uppercase tracking-[0.25em] text-[#FDCC4B]">
          The Vibe
        </span>
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-white transition-colors"
        >
          View gallery
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href="/gallery"
            className="relative shrink-0 snap-start w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border border-white/10 bg-white/5 active:scale-[0.98] transition-transform"
          >
            <Image
              src={item.image_url}
              alt={item.title ?? ""}
              fill
              sizes="(max-width: 768px) 40vw, 12rem"
              className="object-cover"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
