import type { TrendKind } from "./types";

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
