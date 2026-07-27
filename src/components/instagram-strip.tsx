import Image from "next/image";
import { SiInstagram } from "react-icons/si";
import { SectionHeading } from "@/components/editorial/section-heading";

export type PromoRow = {
  id: number;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string | null;
  external_url: string | null;
};

function instagramHandle(value: string | null): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  return (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, "").trim() || null;
}

export function InstagramStrip({
  posts,
  handle,
}: {
  posts: PromoRow[];
  handle: string | null;
}) {
  const tiles = posts.slice(0, 6);
  if (tiles.length === 0) return null;

  const cleanHandle = instagramHandle(handle);
  const profileHref = cleanHandle ? `https://instagram.com/${cleanHandle}` : null;

  return (
    <section id="instagram" className="scroll-mt-24">
      <SectionHeading
        eyebrow="Follow along"
        title="Instagram Feed"
        action={{ href: "/gallery", label: "View Gallery" }}
      />

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((post) => (
          <PostTile key={post.id} post={post} profileHref={profileHref} />
        ))}
      </ul>

      {profileHref && (
        <a
          href={profileHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas-2 font-black text-[11px] tracking-widest text-ink-2 uppercase transition-colors hover:border-white/30 hover:bg-white/10 hover:text-ink sm:w-auto sm:px-6"
        >
          <SiInstagram className="h-4 w-4 shrink-0 text-[#E1306C]" aria-hidden="true" />
          {cleanHandle}
        </a>
      )}
    </section>
  );
}

function PostTile({
  post,
  profileHref,
}: {
  post: PromoRow;
  profileHref: string | null;
}) {
  const href = post.external_url || profileHref;
  const isVideo = post.media_type === "video";

  const media = isVideo ? (
    <video
      src={post.media_url}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  ) : (
    <Image
      src={post.media_url}
      alt={post.title}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );

  const body = (
    <>
      {media}
      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
      <SiInstagram
        className="absolute top-2.5 right-2.5 h-4 w-4 text-white/70 transition-colors group-hover:text-[#FDCC4B]"
        aria-hidden="true"
      />
      <span className="absolute right-2.5 bottom-2 left-2.5 line-clamp-2 font-black text-[10px] leading-tight tracking-wide text-ink uppercase">
        {post.title}
      </span>
    </>
  );

  return (
    <li className="relative aspect-square overflow-hidden rounded-2xl border border-hairline bg-canvas-2 transition-colors hover:border-white/30">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group absolute inset-0 block"
        >
          {body}
          <span className="sr-only">View on Instagram</span>
        </a>
      ) : (
        <div className="group absolute inset-0">{body}</div>
      )}
    </li>
  );
}
