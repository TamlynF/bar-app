"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Play, CalendarDays } from "lucide-react";

type GalleryItem = {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
  media_type: string;
  created_at: string;
};

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  const close = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [selected, close]);

  return (
    <>
      {/* Thumbnail Grid — awwwards-style, hover-zoom */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="group block w-full text-left focus:outline-none"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl hover:shadow-black/30 active:scale-[0.98]">
              <div className="relative aspect-square bg-black">
                {item.media_type === "video" ? (
                  <>
                    <video
                      src={`${item.image_url}#t=0.1`}
                      className="absolute inset-0 h-full w-full object-contain"
                      muted
                      preload="metadata"
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-sm">
                        <Play className="ml-0.5 h-4 w-4 text-white" fill="white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox — full-screen with info overlayed on bottom-right */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/80 backdrop-blur-xl duration-200 fade-in"
          onClick={close}
        >
          {/* Close button */}
          <button
            type="button"
            title="Close"
            onClick={close}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Media + overlay container */}
          <div
            className="relative flex h-full w-full animate-in items-center justify-center p-4 duration-200 zoom-in-95 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* The media */}
            {selected.media_type === "video" ? (
              <video
                src={selected.image_url}
                className="max-h-full max-w-full rounded-2xl object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <Image
                src={selected.image_url}
                alt={selected.title}
                width={1600}
                height={1200}
                className="max-h-full max-w-full rounded-2xl object-contain"
                sizes="95vw"
                priority
              />
            )}

            {/* Info overlay — bottom right corner on the media */}
            <div className="absolute right-6 bottom-6 max-w-xs rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur-md sm:right-10 sm:bottom-10">
              <h3 className="font-black text-sm leading-tight tracking-tight text-white uppercase sm:text-base">
                {selected.title}
              </h3>
              {selected.description && (
                <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-stone-300 sm:text-xs">
                  {selected.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-1.5 text-stone-500">
                <CalendarDays className="h-3 w-3" />
                <span className="text-[9px] font-bold tracking-wider uppercase">
                  {new Date(selected.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
