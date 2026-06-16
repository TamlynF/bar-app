import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/editorial/section-heading";
import { Slider } from "@/components/editorial/slider";

export type GalleryPeekItem = {
  id: number;
  title: string | null;
  image_url: string;
};

/**
 * Home-page gallery peek: an editorial heading + an awwwards-style slider of
 * recent gallery photos with hover-zoom, linking to the full /gallery. Renders
 * nothing when there are no photos.
 */
export function GalleryPeek({ items }: { items: GalleryPeekItem[] }) {
  if (items.length === 0) return null;

  return (
    <section id="gallery" className="scroll-mt-24">
      <SectionHeading
        eyebrow="The vibe"
        title="Gallery"
        action={{ href: "/gallery", label: "View gallery" }}
      />

      <Slider ariaLabel="Recent photos from the bar">
        {items.map((item) => (
          <Link
            key={item.id}
            href="/gallery"
            className="group relative shrink-0 snap-start w-52 h-64 sm:w-64 sm:h-80 rounded-2xl overflow-hidden border border-white/10 bg-white/5"
          >
            <Image
              src={item.image_url}
              alt={item.title ?? ""}
              fill
              sizes="(max-width: 768px) 52vw, 16rem"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </Slider>
    </section>
  );
}
