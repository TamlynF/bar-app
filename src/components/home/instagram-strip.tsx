import Image from "next/image";
import { Play } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { SectionHeading } from "@/components/editorial/section-heading";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { carouselArrowClass } from "@/components/home/carousel-arrows";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import { viewsLabel, type InstagramPost } from "@/lib/instagram-feed";
import { cn } from "@/lib/utils";

const MAX_TILES = 6;

function ReelTile({ post, sizes }: { post: InstagramPost; sizes: string }) {
  const views = viewsLabel(post.views);
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${post.caption} - opens on Instagram`}
      className="group relative block aspect-5/7 w-full overflow-hidden rounded-xl border border-hairline bg-canvas-2 transition-colors hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <Image
        src={post.imageUrl}
        alt=""
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {post.kind === "reel" && (
        <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/70">
          <Play className="ml-0.5 h-3 w-3 text-ink" fill="currentColor" aria-hidden="true" />
        </span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black via-black/70 to-transparent opacity-80 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 transition-all duration-300 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
        <span className="line-clamp-3 text-meta leading-snug text-ink drop-shadow-sm">{post.caption}</span>
        {views && <span className="text-pill font-bold tracking-wide text-ink/80 uppercase drop-shadow-sm">{views}</span>}
      </span>
    </a>
  );
}

/* The latest reels from @donfenticas, laid out like the gallery strip: six
   across from tablet up, a swipeable carousel on phones. Captions sit under
   a fade that appears on hover (always shown on phones, which can't hover);
   every tile opens the post on Instagram. */
export function InstagramStrip({ posts, profileUrl, className }: { posts: InstagramPost[]; profileUrl: string; className?: string }) {
  const tiles = posts.slice(0, MAX_TILES);
  if (tiles.length === 0) return null;

  return (
    <section id="instagram" aria-labelledby="instagram-heading" className={cn("scroll-mt-24", className)}>
      <SectionHeading
        eyebrow="Latest reels"
        title="On Instagram"
        id="instagram-heading"
        trailing={
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-btn font-semibold whitespace-nowrap transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              SOCIAL_BRANDS.instagram.solid
            )}
          >
            <SiInstagram className="h-4 w-4 shrink-0" aria-hidden="true" />
            Follow @donfenticas
          </a>
        }
      />

      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="-mx-4 md:hidden">
        <CarouselContent viewportClassName="px-4" className="-ml-2.5">
          {tiles.map((post) => (
            <CarouselItem key={post.id} className="basis-[48%] pl-2.5">
              <ReelTile post={post} sizes="48vw" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-3 flex items-center justify-between px-4">
          <span className="flex items-center gap-1.5 text-meta font-semibold text-ink-2">
            <SiInstagram className="h-3.5 w-3.5" aria-hidden="true" />
            {tiles.length} reels
          </span>
          <div className="flex items-center gap-2">
            <CarouselPrevious className={carouselArrowClass} />
            <CarouselNext className={carouselArrowClass} />
          </div>
        </div>
      </Carousel>

      <ul className="hidden md:grid md:grid-cols-6 md:gap-4">
        {tiles.map((post) => (
          <li key={post.id}>
            <ReelTile post={post} sizes="(min-width: 768px) 16vw, 48vw" />
          </li>
        ))}
      </ul>

    </section>
  );
}
