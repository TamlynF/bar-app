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

        // Shift the wash away from the artwork's own lightness so the image reads
        // clearly against it (a gold logo shouldn't sit on a gold field): deepen a
        // bright image, lift a dark one — keeping the hue so the page still themes.
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        let wr: number, wg: number, wb: number;
        if (lum > 0.5) {
          const f = 0.42; // deepen a light/bright image
          wr = Math.round(r * f); wg = Math.round(g * f); wb = Math.round(b * f);
        } else {
          const t = 0.5; // lift a dark image toward a lighter tint of the same hue
          wr = Math.round(r + (255 - r) * t);
          wg = Math.round(g + (255 - g) * t);
          wb = Math.round(b + (255 - b) * t);
        }
        root.style.setProperty("--ev-theme", `rgb(${wr} ${wg} ${wb})`);

        // Publish a legible foreground for text/icons on the wash + inputs, contrasting
        // the *shifted* wash colour. `--ev-fg` is solid (labels, icons); `--ev-fg-dim`
        // is muted (placeholders, subtext).
        const washLum = (0.299 * wr + 0.587 * wg + 0.114 * wb) / 255;
        const fgRgb = washLum > 0.58 ? "28 25 23" : "245 245 244"; // near-black vs near-white
        root.style.setProperty("--ev-fg", `rgb(${fgRgb})`);
        root.style.setProperty("--ev-fg-dim", `rgb(${fgRgb} / 0.62)`);
      } catch {
        /* tainted canvas / CORS failure — keep default theme */
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      root.style.removeProperty("--ev-theme");
      root.style.removeProperty("--ev-fg");
      root.style.removeProperty("--ev-fg-dim");
    };
  }, [imageUrl]);

  return null;
}
