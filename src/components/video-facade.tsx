"use client";

import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";

function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function isVideoFile(url: string): boolean {
  return url.includes(".supabase.co") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function VideoFacade({
  url,
  title = "Video",
  className = "",
}: {
  url: string;
  title?: string;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const ytId = youTubeId(url);
  const embeddable = Boolean(ytId) || isVideoFile(url);

  if (!embeddable) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-[#E6DFC8] bg-white text-[#5F624F] transition-colors hover:bg-[#F7F4EA] ${className}`}
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        <span className="font-black text-xs tracking-wide uppercase">{title}</span>
      </a>
    );
  }

  if (active) {
    return ytId ? (
      <iframe
        className={`aspect-video w-full rounded-2xl border border-black/10 ${className}`}
        src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
        title={title}
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    ) : (
      <video
        className={`aspect-video w-full rounded-2xl bg-black ${className}`}
        src={url}
        autoPlay
        controls
        playsInline
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label={`Play ${title}`}
      className={`group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-[#1F1F1A] transition-transform active:scale-[0.99] ${className}`}
    >
      {ytId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" />
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/90 text-[#1F1F1A] transition-transform group-hover:scale-110">
        <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true" />
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 text-left">
        <span className="line-clamp-1 font-black text-xs tracking-tight text-white uppercase">
          {title}
        </span>
      </span>
    </button>
  );
}
