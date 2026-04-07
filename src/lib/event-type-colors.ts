export const EVENT_TYPE_COLORS = [
  { key: "amber",  swatch: "#FCD34D", badge: "bg-amber-100 text-amber-700 border border-amber-200" },
  { key: "green",  swatch: "#6EE7B7", badge: "bg-green-100 text-green-700 border border-green-200" },
  { key: "purple", swatch: "#C4B5FD", badge: "bg-purple-100 text-purple-700 border border-purple-200" },
  { key: "blue",   swatch: "#93C5FD", badge: "bg-blue-100 text-blue-700 border border-blue-200" },
  { key: "rose",   swatch: "#FDA4AF", badge: "bg-rose-100 text-rose-700 border border-rose-200" },
  { key: "sky",    swatch: "#7DD3FC", badge: "bg-sky-100 text-sky-700 border border-sky-200" },
  { key: "orange", swatch: "#FDBA74", badge: "bg-orange-100 text-orange-700 border border-orange-200" },
  { key: "teal",   swatch: "#5EEAD4", badge: "bg-teal-100 text-teal-700 border border-teal-200" },
  { key: "indigo", swatch: "#A5B4FC", badge: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  { key: "pink",   swatch: "#F9A8D4", badge: "bg-pink-100 text-pink-700 border border-pink-200" },
] as const;

export type ColorKey = typeof EVENT_TYPE_COLORS[number]["key"];

export const FALLBACK_BADGE = "bg-[#F7F4EA] text-[#5F624F] border border-[#E6DFC8]";

export function badgeClassFromColor(color: string | null | undefined): string {
  const found = EVENT_TYPE_COLORS.find(c => c.key === color);
  return found ? found.badge : FALLBACK_BADGE;
}
