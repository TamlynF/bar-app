import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { countLabel, isVideo, type GalleryGroup } from "@/lib/gallery-categories";
import { cn } from "@/lib/utils";

export function galleryHref(slug: string): string {
  return `/gallery/${slug}`;
}

export function CategoryCover({ group, sizes }: { group: GalleryGroup; sizes: string }) {
  const cover = group.cover;
  return isVideo(cover) ? (
    <>
      <video
        src={`${cover.image_url}#t=0.1`}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        preload="metadata"
        playsInline
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/70">
        <Play className="ml-0.5 h-3 w-3 text-ink" fill="currentColor" aria-hidden="true" />
      </span>
    </>
  ) : (
    <Image src={cover.image_url} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
  );
}

/* One category as a card: cover on top, name and what's in it underneath. */
export function CategoryCard({ group, sizes, className }: { group: GalleryGroup; sizes: string; className?: string }) {
  return (
    <Link
      href={galleryHref(group.slug)}
      aria-label={`${group.name}, ${countLabel(group)}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-canvas-2 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        className
      )}
    >
      <span className="relative block aspect-square w-full overflow-hidden bg-canvas">
        <CategoryCover group={group} sizes={sizes} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black via-black/70 to-transparent"
        />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
          <span className="truncate font-black text-btn leading-tight tracking-tight text-ink uppercase drop-shadow-sm group-hover:text-gold">
            {group.name}
          </span>
          <span className="text-meta text-ink/80 drop-shadow-sm">{countLabel(group)}</span>
        </span>
      </span>
    </Link>
  );
}
