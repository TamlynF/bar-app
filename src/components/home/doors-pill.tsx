"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const LIGHT_POSTER = 0.6;

/* The "Doors 8pm" pill on the featured ticket. It samples the patch of
   poster it sits over and flips to dark-on-cream when that patch is light,
   so the time reads on any artwork. */
export function DoorsPill({
  imageUrl,
  className,
  children,
}: {
  imageUrl: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [lightPoster, setLightPoster] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 32, 32);
      const { data } = ctx.getImageData(4, 16, 16, 4);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      setLightPoster(total / (data.length / 4) / 255 > LIGHT_POSTER);
    };
    img.src = `/_next/image?url=${encodeURIComponent(imageUrl)}&w=256&q=75`;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 rounded-full px-3 py-2 text-[13px] leading-none font-extrabold tracking-[0.04em] ring-1 backdrop-blur-[6px]",
        lightPoster ? "bg-ink/85 text-canvas ring-black/20" : "bg-black/70 text-ink ring-ink/15",
        className
      )}
    >
      {children}
    </span>
  );
}
