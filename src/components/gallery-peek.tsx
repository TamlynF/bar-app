import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/editorial/section-heading";

export type GalleryPeekItem = {
  id: number;
  title: string | null;
  image_url: string;
};

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

      <div className="grid auto-rows-[120px] grid-cols-2 gap-2.5 sm:auto-rows-[140px] sm:grid-cols-3">
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
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            {item.title && (
              <span className="absolute right-3 bottom-2 left-3 font-black text-[10px] tracking-wide text-ink uppercase opacity-0 transition-opacity group-hover:opacity-100">
                {item.title}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
