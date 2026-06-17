"use client";

import { useEffect } from "react";

/**
 * Samples the booking image client-side and exposes its dominant *vibrant* colour
 * as a CSS variable (`--ev-theme`) on <html>, so the page's gradient layers can
 * theme themselves to the image. Renders nothing.
 *
 * Degrades silently: if the image can't be read (CORS-tainted canvas) or has no
 * vibrant colour (e.g. a greyscale logo), the variable is left unset and the page
 * keeps its default olive theme via the `var(--ev-theme, …)` fallbacks.
 */
export default function ImageThemer({ imageUrl }: { imageUrl: string }) {
  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 48; // small sample — plenty for a dominant colour
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket pixels by a coarse (4-bit/channel) colour key, weighting each
        // bucket by saturation so vibrant colours win over muddy/grey ones.
        type Bucket = { count: number; weight: number; r: number; g: number; b: number };
        const buckets = new Map<number, Bucket>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 125) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = (max + min) / 2;
          if (lightness < 32 || lightness > 232) continue; // skip near-black / near-white
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.18) continue; // skip greys
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const bkt = buckets.get(key) ?? { count: 0, weight: 0, r: 0, g: 0, b: 0 };
          bkt.count += 1;
          bkt.weight += sat;
          bkt.r += r; bkt.g += g; bkt.b += b;
          buckets.set(key, bkt);
        }

        let best: Bucket | null = null;
        for (const bkt of buckets.values()) {
          if (!best || bkt.weight > best.weight) best = bkt;
        }
        if (!best) return; // nothing vibrant — keep default olive theme

        const r = Math.round(best.r / best.count);
        const g = Math.round(best.g / best.count);
        const b = Math.round(best.b / best.count);
        root.style.setProperty("--ev-theme", `rgb(${r} ${g} ${b})`);
      } catch {
        /* tainted canvas / CORS failure — keep default theme */
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      root.style.removeProperty("--ev-theme");
    };
  }, [imageUrl]);

  return null;
}
