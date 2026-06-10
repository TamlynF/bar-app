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
