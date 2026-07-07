import type { TrendKind } from "./types";

/**
 * Deterministic dedupe key for a trend. Trends with the same signature are
 * stored once (unique index), so a refresh never resurfaces a trend the user
 * already saved or ignored. Derived from kind + normalised title (+ source).
 */
export function trendSignature(kind: TrendKind, title: string, sourceName?: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const parts = [kind, norm(title)];
  if (sourceName) parts.push(norm(sourceName));
  return parts.filter(Boolean).join(":");
}
