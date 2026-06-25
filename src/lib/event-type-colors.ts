export const EVENT_TYPE_COLORS = [
  { key: "amber",   swatchClass: "swatch-amber",   badge: "bg-amber-100 text-amber-700 border border-amber-200" },
  { key: "green",   swatchClass: "swatch-green",   badge: "bg-green-100 text-green-700 border border-green-200" },
  { key: "purple",  swatchClass: "swatch-purple",  badge: "bg-purple-100 text-purple-700 border border-purple-200" },
  { key: "blue",    swatchClass: "swatch-blue",    badge: "bg-blue-100 text-blue-700 border border-blue-200" },
  { key: "rose",    swatchClass: "swatch-rose",    badge: "bg-rose-100 text-rose-700 border border-rose-200" },
  { key: "sky",     swatchClass: "swatch-sky",     badge: "bg-sky-100 text-sky-700 border border-sky-200" },
  { key: "orange",  swatchClass: "swatch-orange",  badge: "bg-orange-100 text-orange-700 border border-orange-200" },
  { key: "teal",    swatchClass: "swatch-teal",    badge: "bg-teal-100 text-teal-700 border border-teal-200" },
  { key: "indigo",  swatchClass: "swatch-indigo",  badge: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  { key: "pink",    swatchClass: "swatch-pink",    badge: "bg-pink-100 text-pink-700 border border-pink-200" },
  { key: "red",     swatchClass: "swatch-red",     badge: "bg-red-100 text-red-700 border border-red-200" },
  { key: "yellow",  swatchClass: "swatch-yellow",  badge: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  { key: "emerald", swatchClass: "swatch-emerald", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  { key: "lime",    swatchClass: "swatch-lime",    badge: "bg-lime-100 text-lime-700 border border-lime-200" },
  { key: "cyan",    swatchClass: "swatch-cyan",    badge: "bg-cyan-100 text-cyan-700 border border-cyan-200" },
  { key: "violet",  swatchClass: "swatch-violet",  badge: "bg-violet-100 text-violet-700 border border-violet-200" },
  { key: "fuchsia", swatchClass: "swatch-fuchsia", badge: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" },
  { key: "slate",   swatchClass: "swatch-slate",   badge: "bg-slate-100 text-slate-700 border border-slate-200" },
  { key: "zinc",    swatchClass: "swatch-zinc",    badge: "bg-zinc-100 text-zinc-700 border border-zinc-200" },
  { key: "stone",   swatchClass: "swatch-stone",   badge: "bg-stone-100 text-stone-700 border border-stone-200" },
] as const;

export type ColorKey = typeof EVENT_TYPE_COLORS[number]["key"];

const SWATCH_HEX: Record<string, string> = {
  amber: "#FCD34D", green: "#6EE7B7", purple: "#C4B5FD", blue: "#93C5FD",
  rose: "#FDA4AF", sky: "#7DD3FC", orange: "#FDBA74", teal: "#5EEAD4",
  indigo: "#A5B4FC", pink: "#F9A8D4", red: "#F87171", yellow: "#FACC15",
  emerald: "#34D399", lime: "#A3E635", cyan: "#22D3EE", violet: "#8B5CF6",
  fuchsia: "#D946EF", slate: "#94A3B8", zinc: "#A1A1AA", stone: "#A8A29E",
};

/**
 * Full hex quad per colour key — `bg` (light fill), `text` (readable ink),
 * `border`, and `solid` (the saturated accent). Used by the Event Categories
 * redesign to drive category/sub-category tinting through CSS custom properties
 * (set via `style`, consumed via Tailwind arbitrary values) rather than the
 * static `badge`/`swatchClass` Tailwind classes above.
 */
export type ColorHex = { bg: string; text: string; border: string; solid: string };

const COLOR_HEX: Record<string, ColorHex> = {
  amber:   { bg: "#fef3c7", text: "#b45309", border: "#fde68a", solid: "#fbbf24" },
  green:   { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0", solid: "#4ade80" },
  purple:  { bg: "#f3e8ff", text: "#7e22ce", border: "#e9d5ff", solid: "#c084fc" },
  blue:    { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe", solid: "#60a5fa" },
  rose:    { bg: "#ffe4e6", text: "#be123c", border: "#fecdd3", solid: "#fb7185" },
  sky:     { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd", solid: "#38bdf8" },
  orange:  { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa", solid: "#fb923c" },
  teal:    { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4", solid: "#2dd4bf" },
  indigo:  { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe", solid: "#818cf8" },
  pink:    { bg: "#fce7f3", text: "#be185d", border: "#fbcfe8", solid: "#f472b6" },
  red:     { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca", solid: "#f87171" },
  yellow:  { bg: "#fef9c3", text: "#a16207", border: "#fef08a", solid: "#facc15" },
  emerald: { bg: "#d1fae5", text: "#047857", border: "#a7f3d0", solid: "#34d399" },
  lime:    { bg: "#ecfccb", text: "#4d7c0f", border: "#d9f99d", solid: "#a3e635" },
  cyan:    { bg: "#cffafe", text: "#0e7490", border: "#a5f3fc", solid: "#22d3ee" },
  violet:  { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe", solid: "#a78bfa" },
  fuchsia: { bg: "#fae8ff", text: "#a21caf", border: "#f5d0fe", solid: "#e879f9" },
  slate:   { bg: "#f1f5f9", text: "#334155", border: "#e2e8f0", solid: "#94a3b8" },
  zinc:    { bg: "#f4f4f5", text: "#3f3f46", border: "#e4e4e7", solid: "#a1a1aa" },
  stone:   { bg: "#f5f5f4", text: "#44403c", border: "#e7e5e4", solid: "#a8a29e" },
};

/** Neutral cream/tan fallback used when a record has no colour set. */
export const FALLBACK_COLOR_HEX: ColorHex = { bg: "#F7F4EA", text: "#5F624F", border: "#E6DFC8", solid: "#E6DFC8" };

export function colorHexFromKey(color: string | null | undefined): ColorHex {
  return (color && COLOR_HEX[color]) || FALLBACK_COLOR_HEX;
}

export const FALLBACK_BADGE = "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";

export function badgeClassFromColor(color: string | null | undefined): string {
  const found = EVENT_TYPE_COLORS.find(c => c.key === color);
  return found ? found.badge : FALLBACK_BADGE;
}

export function swatchHexFromColor(color: string | null | undefined): string | undefined {
  return color ? SWATCH_HEX[color] : undefined;
}

export function swatchClassFromColor(color: string | null | undefined): string {
  const found = EVENT_TYPE_COLORS.find(c => c.key === color);
  return found ? found.swatchClass : "bg-[#F7F4EA]";
}
