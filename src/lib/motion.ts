import type { CSSProperties } from "react";

export const EASE_LUXE = "cubic-bezier(0.22, 1, 0.36, 1)";

function hash(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/* Floating variant: a slow vertical drift of 2-5px over 5-10s, offset by a
   per-card delay so no two cards move in step. Deterministic from the seed,
   so server and client render the same values. Pair with the `ad-float`
   class. */
export function floatingVariant(seed: string | number): CSSProperties {
  const r = hash(seed);
  const r2 = hash(`${seed}:2`);
  return {
    "--float-y": `${(2 + r * 3).toFixed(1)}px`,
    "--float-dur": `${(5 + r2 * 5).toFixed(1)}s`,
    "--float-delay": `${(-r * 8).toFixed(1)}s`,
  } as CSSProperties;
}

/* Reveal stagger: children of a section land one after another. */
export function revealDelay(index: number, stepMs = 80, maxSteps = 6): CSSProperties {
  return { "--reveal-delay": `${Math.min(index, maxSteps) * stepMs}ms` } as CSSProperties;
}
