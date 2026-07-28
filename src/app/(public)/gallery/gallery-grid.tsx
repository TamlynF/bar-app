"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Play, CalendarDays, ChevronLeft, ChevronRight, Video } from "lucide-react";

export type GalleryItem = {
  id: number;
  title: string;
  description: string | null;
  image_url: string;
  media_type: string;
  created_label: string;
};

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const selected = openIndex === null ? null : items[openIndex];

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + items.length) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [openIndex, close, step]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#FDCC4B]/40 hover:bg-white/6 hover:shadow-2xl hover:shadow-black/40 focus-visible:border-[#FDCC4B] focus-visible:outline-none active:scale-[0.98]"
          >
            <div className="relative aspect-4/3 w-full overflow-hidden bg-black">
              {item.media_type === "video" ? (
                <>
                  <video
                    src={`${item.image_url}#t=0.1`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    preload="metadata"
                    playsInline
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-1.5 py-0.5 font-black text-[9px] tracking-widest text-white uppercase backdrop-blur-sm">
                    <Video className="h-2.5 w-2.5" aria-hidden="true" />
                    Video
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/50 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                      <Play className="ml-0.5 h-3.5 w-3.5 text-white" fill="white" aria-hidden="true" />
                    </span>
                  </span>
                </>
              ) : (
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 17vw"
                />
              )}
              <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>

            <div className="flex flex-1 flex-col gap-0.5 p-2.5 sm:p-3">
              <h3 className="line-clamp-1 font-black text-[11px] tracking-tight text-white uppercase transition-colors group-hover:text-[#FDCC4B] sm:text-xs">
                {item.title}
              </h3>
              {item.description && (
                <p className="line-clamp-2 text-[10px] leading-snug text-stone-400">
                  {item.description}
                </p>
              )}
              <span className="mt-auto flex items-center gap-1 pt-1 text-stone-500">
                <CalendarDays className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                <span className="text-[9px] font-bold tracking-wider uppercase">
                  {item.created_label}
                </span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          className="fixed inset-0 z-50 flex animate-in flex-col bg-black/90 backdrop-blur-xl duration-200 fade-in"
          onClick={close}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <span className="font-bold text-[10px] tracking-widest text-stone-400 tabular-nums uppercase">
              {openIndex! + 1} / {items.length}
            </span>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {items.length > 1 && (
              <button
                type="button"
                title="Previous"
                aria-label="Previous"
                onClick={() => step(-1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 animate-in items-center justify-center duration-200 zoom-in-95">
              {selected.media_type === "video" ? (
                <video
                  key={selected.id}
                  src={selected.image_url}
                  className="max-h-full max-w-full rounded-2xl object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <Image
                  key={selected.id}
                  src={selected.image_url}
                  alt={selected.title}
                  width={1600}
                  height={1200}
                  className="max-h-full w-auto max-w-full rounded-2xl object-contain"
                  sizes="95vw"
                  priority
                />
              )}
            </div>

            {items.length > 1 && (
              <button
                type="button"
                title="Next"
                aria-label="Next"
                onClick={() => step(1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="shrink-0 px-4 pt-3 pb-6 sm:px-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-3xl border-t border-white/10 pt-3">
              <h3 className="font-black text-base leading-tight tracking-tight text-white uppercase sm:text-lg">
                {selected.title}
              </h3>
              {selected.description && (
                <p className="mt-1.5 text-xs leading-relaxed text-stone-300 sm:text-sm">
                  {selected.description}
                </p>
              )}
              <span className="mt-2 flex items-center gap-1.5 text-stone-500">
                <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="text-[9px] font-bold tracking-widest uppercase">
                  {selected.created_label}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
