import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/editorial/section-heading";

export type GalleryPeekItem = {
  id: number;
  title: string | null;
  image_url: string;
};

/**
 * Home "Inside" — After Dark: an asymmetric photo mosaic of the room (the first
 * shot runs tall, a later one runs wide) with a hover-zoom, linking through to
 * the full /gallery. Renders nothing when there are no photos.
 */
export function GalleryPeek({ items }: { items: GalleryPeekItem[] }) {
  if (items.length === 0) return null;

  const shots = items.slice(0, 5);

  return (
    <section id="gallery" className="scroll-mt-24">
      <SectionHeading
        eyebrow="The room"
        title="Inside"
        action={{ href: "/gallery", label: "View gallery" }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 auto-rows-[120px] sm:auto-rows-[140px] gap-2.5">
        {shots.map((item, i) => (
          <Link
            key={item.id}
            href="/gallery"
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-hairline bg-canvas-2",
              i === 0 && "row-span-2",
              i === 3 && "col-span-2"
            )}
          >
            <Image
              src={item.image_url}
              alt={item.title ?? ""}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/55 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {item.title && (
              <span className="absolute bottom-2 left-3 right-3 text-ink text-[10px] font-black uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                {item.title}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
