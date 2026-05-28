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
      {/* Thumbnail Grid — 2 columns, natural aspect ratios */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="block w-full text-left group focus:outline-none"
          >
            <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 active:scale-[0.97]">
              <div className="relative aspect-square bg-black">
                {item.media_type === "video" ? (
                  <>
                    <video
                      src={`${item.image_url}#t=0.1`}
                      className="absolute inset-0 w-full h-full object-contain"
                      muted
                      preload="metadata"
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox — full-screen with info overlayed on bottom-right */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={close}
        >
          {/* Close button */}
          <button
            type="button"
            title="Close"
            onClick={close}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Media + overlay container */}
          <div
            className="relative w-full h-full flex items-center justify-center p-4 sm:p-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* The media */}
            {selected.media_type === "video" ? (
              <video
                src={selected.image_url}
                className="max-w-full max-h-full rounded-2xl object-contain"
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
                className="max-w-full max-h-full rounded-2xl object-contain"
                sizes="95vw"
                priority
              />
            )}

            {/* Info overlay — bottom right corner on the media */}
            <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 max-w-xs bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10">
              <h3 className="text-white font-black text-sm sm:text-base uppercase tracking-tight leading-tight">
                {selected.title}
              </h3>
              {selected.description && (
                <p className="text-stone-300 text-[11px] sm:text-xs mt-1 leading-relaxed line-clamp-3">
                  {selected.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2 text-stone-500">
                <CalendarDays className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-wider">
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
