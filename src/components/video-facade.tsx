"use client";

import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";

/**
 * Lazy "facade" video player: shows a lightweight play tile and only mounts the
 * heavy player once clicked — keeping pages fast (a YouTube embed can pull
 * 1–2MB of third-party scripts). Theme-neutral (dark tile + white control) so
 * it works on both the public olive/gold and admin espresso/cream surfaces.
 *
 * Handles three url kinds automatically:
 *  - YouTube link  → inline iframe embed
 *  - direct video file (e.g. Supabase Storage mp4) → inline <video>
 *  - anything else (vimeo/social/etc.) → external-link tile (can't embed)
 */
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

  // Non-embeddable (vimeo/social/etc.) — keep it a link, don't try to play inline.
  if (!embeddable) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA] transition-colors ${className}`}
      >
        <ExternalLink className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs font-black uppercase tracking-wide">{title}</span>
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
      className={`group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-[#1F1F1A] active:scale-[0.99] transition-transform ${className}`}
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-[#1F1F1A] group-hover:scale-110 transition-transform">
        <Play className="w-5 h-5 ml-0.5" fill="currentColor" aria-hidden="true" />
      </span>
      <span className="absolute bottom-0 inset-x-0 p-3 bg-linear-to-t from-black/70 to-transparent text-left">
        <span className="text-white text-xs font-black uppercase tracking-tight line-clamp-1">
          {title}
        </span>
      </span>
    </button>
  );
}
