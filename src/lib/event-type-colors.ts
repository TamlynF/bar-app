export const EVENT_TYPE_COLORS = [
  { key: "amber",  swatchClass: "swatch-amber",  badge: "bg-amber-100 text-amber-700 border border-amber-200" },
  { key: "green",  swatchClass: "swatch-green",  badge: "bg-green-100 text-green-700 border border-green-200" },
  { key: "purple", swatchClass: "swatch-purple", badge: "bg-purple-100 text-purple-700 border border-purple-200" },
  { key: "blue",   swatchClass: "swatch-blue",   badge: "bg-blue-100 text-blue-700 border border-blue-200" },
  { key: "rose",   swatchClass: "swatch-rose",   badge: "bg-rose-100 text-rose-700 border border-rose-200" },
  { key: "sky",    swatchClass: "swatch-sky",    badge: "bg-sky-100 text-sky-700 border border-sky-200" },
  { key: "orange", swatchClass: "swatch-orange", badge: "bg-orange-100 text-orange-700 border border-orange-200" },
  { key: "teal",   swatchClass: "swatch-teal",   badge: "bg-teal-100 text-teal-700 border border-teal-200" },
  { key: "indigo", swatchClass: "swatch-indigo", badge: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  { key: "pink",   swatchClass: "swatch-pink",   badge: "bg-pink-100 text-pink-700 border border-pink-200" },
] as const;

export type ColorKey = typeof EVENT_TYPE_COLORS[number]["key"];

export const FALLBACK_BADGE = "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";

export function badgeClassFromColor(color: string | null | undefined): string {
  const found = EVENT_TYPE_COLORS.find(c => c.key === color);
  return found ? found.badge : FALLBACK_BADGE;
}
