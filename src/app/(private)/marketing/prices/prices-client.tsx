"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Zap,
  Loader2,
  Pencil,
  Save,
  MapPin,
  Tags,
  ChevronDown,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGbp } from "@/lib/price";
import { refreshPriceInsightsAction, updateComparisonAreaAction } from "./actions";
import { buildVenueMatrix, rankedVenues } from "../lib/compare";
import { TrendCard } from "../trends/trend-card";
import type { BenchmarkComparison, Verdict } from "../lib/compare";
import type { CompetitorPrice, MarketingTrend, TrendState } from "../lib/types";

type PriceView = "summary" | "byVenue";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Verdict → the word shown beside your price + colour for the range-bar "you" dot.
const VERDICT_WORD: Record<Verdict, { word: string; text: string; dot: string }> = {
  above: { word: "above avg", text: "text-red-600", dot: "#DC2626" },
  below: { word: "below avg", text: "text-green-700", dot: "#15803D" },
  inline: { word: "in line", text: "text-[#B45309]", dot: "#B45309" },
  unknown: { word: "no data", text: "text-[#5F624F]/60", dot: "#8A8D7A" },
};

// Min→max range bar with an avg tick and a your-price dot (desktop only; phone
// swaps to a compact min·avg·max line). Dynamic positions ride CSS custom
// properties consumed by Tailwind arbitrary values (no standard inline styles).
function RangeBar({ c }: { c: BenchmarkComparison }) {
  const min = c.competitorMin as number;
  const max = c.competitorMax as number;
  const avg = c.competitorAvg as number;
  const own = c.ownPrice;
  const lo = Math.min(own ?? min, min) * 0.92;
  const hi = Math.max(own ?? max, max) * 1.06;
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;
  const bandLeft = pct(min);
  const bandWidth = Math.max(pct(max) - bandLeft, 1.5);

  return (
    <div className="sm:flex flex-col gap-1.5 hidden">
      <div className="relative h-3.5">
        <div className="top-1.5 right-0 left-0 absolute bg-[#E6DFC8] rounded h-0.5" />
        <div
          className="top-[5px] absolute bg-[#D9D2B8] rounded h-1 left-[var(--l)] w-[var(--w)]"
          style={{ "--l": `${bandLeft}%`, "--w": `${bandWidth}%` } as React.CSSProperties}
        />
        <div
          className="top-0.5 absolute bg-[#5F624F] rounded w-0.5 h-2.5 -translate-x-px left-[var(--l)]"
          style={{ "--l": `${pct(avg)}%` } as React.CSSProperties}
        />
        {own != null && (
          <div
            className="top-px absolute bg-[var(--dot)] shadow-[0_1px_4px_rgba(31,31,26,0.35)] border-2 border-white rounded-full w-3 h-3 -translate-x-1.5 left-[var(--l)]"
            style={{ "--l": `${pct(own)}%`, "--dot": VERDICT_WORD[c.verdict].dot } as React.CSSProperties}
          />
        )}
      </div>
      <div className="flex justify-between tabular-nums text-[#5F624F] text-[9.5px]">
        <span>{formatGbp(min)}</span>
        <span className="font-black">
          avg {formatGbp(avg)} <span className="opacity-55">({c.sampleCount})</span>
        </span>
        <span>{formatGbp(max)}</span>
      </div>
    </div>
  );
}

export default function PricesClient({
  area,
  radius,
  lastRefresh,
  comparison,
  competitorPrices,
  priceTrends,
  onSetTrendState,
  pendingTrendId,
}: {
  area: string;
  radius: string | null;
  lastRefresh: string | null;
  comparison: BenchmarkComparison[];
  competitorPrices: CompetitorPrice[];
  priceTrends: MarketingTrend[];
  onSetTrendState: (id: string, state: TrendState) => void;
  pendingTrendId: string | null;
}) {
  const MAX_VENUES = 4;
  const [isRefreshing, startRefresh] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [view, setView] = useState<PriceView>("summary");
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  // null = use the default (top few by relevance); array = the user's explicit pick.
  const [pickedVenues, setPickedVenues] = useState<string[] | null>(null);

  const allVenues = useMemo(() => rankedVenues(competitorPrices), [competitorPrices]);
  const shownVenues = useMemo(() => {
    if (pickedVenues == null) return allVenues.slice(0, MAX_VENUES);
    const kept = pickedVenues.filter((v) => allVenues.includes(v));
    return (kept.length ? kept : allVenues.slice(0, MAX_VENUES)).slice(0, MAX_VENUES);
  }, [pickedVenues, allVenues]);
  const matrix = buildVenueMatrix(competitorPrices, comparison, shownVenues);

  const toggleVenue = (v: string) => {
    setPickedVenues((prev) => {
      const base = prev ?? allVenues.slice(0, MAX_VENUES);
      if (base.includes(v)) return base.filter((x) => x !== v);
      if (base.length >= MAX_VENUES) return base; // capped at 4
      return [...base, v];
    });
  };

  const handleRefresh = () => {
    startRefresh(async () => {
      const result = await refreshPriceInsightsAction();
      if ("error" in result) toast.error(result.error);
      else
        toast.success(
          `Updated ${result.priceCount} price${result.priceCount === 1 ? "" : "s"} · ${result.ideaCount} new idea${result.ideaCount === 1 ? "" : "s"}.`,
        );
    });
  };

  const handleSaveArea = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      const result = await updateComparisonAreaAction(formData);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Comparison area updated.");
        setIsEditing(false);
      }
    });
  };

  // Headline insights — the items where you sit furthest from the local average.
  const insights = comparison
    .filter((c) => c.ownPrice != null && c.competitorAvg != null && c.sampleCount > 0)
    .map((c) => ({ label: c.label, diff: (c.ownPrice as number) - (c.competitorAvg as number) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2);

  return (
    <div className="space-y-3 space-y-4 px-2 sm:px-4 md:px-6 py-0 py-3 max-w-3xl">
      {/* Area + refresh */}
      <section className="space-y-3 bg-white p-4 sm:p-5 border border-[#E6DFC8] rounded-2xl">
        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1.5 text-[#5F624F]">
                <MapPin className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                {/* Phone: just the address, smaller and not bold */}
                <p className="sm:hidden font-normal text-[11px] normal-case tracking-normal">{area}</p>
                {/* Desktop: full comparison descriptor */}
                <p className="hidden sm:block font-black text-[10px] uppercase tracking-widest">
                  Comparing {area}
                  {radius ? ` · ${radius}` : ""} · bars, pubs, music venues &amp; hospitality only
                </p>
              </div>
              <p className="opacity-70 mt-1 tabular-nums text-[#5F624F] text-[11px]">
                Prices last refreshed {formatWhen(lastRefresh)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Change area"
              title="Change area"
              className="flex items-center gap-2 bg-[#B45309] hover:bg-[#B45309]/85 px-4 max-sm:px-0 max-sm:w-11 max-sm:justify-center rounded-xl h-11 font-black text-[10px] text-white uppercase tracking-widest active:scale-95 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
              <span className="sm:inline hidden">Change area</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveArea} className="space-y-3">
            <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
              <label className="block">
                <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-widest">Area / Town</span>
                <input
                  name="comparison_area"
                  defaultValue={area}
                  required
                  placeholder="e.g. Hinckley"
                  className="bg-[#F7F4EA] mt-1 px-3 border border-[#E6DFC8] focus:border-[#5C4033] rounded-xl outline-none w-full h-11 font-bold text-[#1F1F1A] text-sm"
                />
              </label>
              <label className="block">
                <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-widest">Radius (optional)</span>
                <input
                  name="comparison_radius"
                  defaultValue={radius ?? ""}
                  placeholder="e.g. 5 miles"
                  className="bg-[#F7F4EA] mt-1 px-3 border border-[#E6DFC8] focus:border-[#5C4033] rounded-xl outline-none w-full h-11 font-bold text-[#1F1F1A] text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="bg-white px-4 border border-[#E6DFC8] rounded-xl h-11 font-black text-[#5F624F] text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-60 px-5 rounded-xl h-11 font-black text-[10px] text-white uppercase tracking-widest"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
            <p className="opacity-70 text-[#5F624F] text-[10px]">
              Changing the area? Hit Refresh afterwards to pull prices for the new location.
            </p>
          </form>
        )}
      </section>

      {/* Headline insights — biggest gaps vs the local average */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((ins) => (
            <span
              key={ins.label}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl font-black text-[11px] uppercase tracking-wide",
                ins.diff > 0
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-green-700 bg-green-50 border-green-200",
              )}
            >
              {ins.diff > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {ins.label}: you&apos;re {formatGbp(Math.abs(ins.diff))} {ins.diff > 0 ? "above" : "below"} local avg
            </span>
          ))}
        </div>
      )}

      {/* Comparison */}
      <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center gap-2 bg-[#F7F4EA] px-4 sm:px-5 py-3 border-[#E6DFC8] border-b">
          <p className="font-black text-[#5C4033] text-[11px] uppercase tracking-widest">Your menu vs local venues</p>
          {competitorPrices.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {(["summary", "byVenue"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setView(m)}
                  className={cn(
                    "px-2.5 border rounded-lg h-7 font-black text-[9px] uppercase tracking-widest transition-colors",
                    view === m
                      ? "bg-[#5C4033] border-[#5C4033] text-white"
                      : "bg-white border-[#E6DFC8] text-[#5F624F] hover:bg-white/60",
                  )}
                >
                  {m === "summary" ? "Avg" : "By venue"}
                </button>
              ))}

              {/* Venue picker — choose up to 4 venues for the By-venue grid */}
              {view === "byVenue" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVenuePickerOpen((o) => !o)}
                    aria-label="Choose venues"
                    title="Choose venues"
                    className={cn(
                      "flex items-center justify-center border rounded-lg w-7 h-7 transition-colors",
                      venuePickerOpen
                        ? "bg-[#5C4033] border-[#5C4033] text-white"
                        : "bg-white border-[#E6DFC8] text-[#5F624F] hover:bg-white/60",
                    )}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {venuePickerOpen && (
                    <>
                      <div className="z-40 fixed inset-0" onClick={() => setVenuePickerOpen(false)} aria-hidden="true" />
                      <div className="right-0 z-50 absolute bg-white shadow-lg mt-1 border border-[#E6DFC8] rounded-xl w-60 overflow-hidden">
                        <div className="flex justify-between items-center gap-2 bg-[#F7F4EA] px-3 py-2 border-[#E6DFC8] border-b">
                          <span className="font-black text-[#5C4033] text-[9px] uppercase tracking-widest">
                            Show venues ({shownVenues.length}/{MAX_VENUES})
                          </span>
                          {pickedVenues != null && (
                            <button
                              type="button"
                              onClick={() => setPickedVenues(null)}
                              className="font-black text-[#5F624F] hover:text-[#5C4033] text-[9px] uppercase tracking-widest"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {allVenues.length === 0 ? (
                          <p className="px-3 py-4 text-[#5F624F]/70 text-[11px]">No venues to choose yet — refresh prices first.</p>
                        ) : (
                          <div className="p-1 max-h-64 overflow-y-auto">
                            {allVenues.map((v) => {
                              const checked = shownVenues.includes(v);
                              const atCap = shownVenues.length >= MAX_VENUES;
                              return (
                                <label
                                  key={v}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer",
                                    !checked && atCap ? "opacity-40 cursor-not-allowed" : "hover:bg-[#F7F4EA]",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!checked && atCap}
                                    onChange={() => toggleVenue(v)}
                                    className="accent-[#5C4033] w-3.5 h-3.5 shrink-0"
                                  />
                                  <span className="min-w-0 font-bold text-[#1F1F1A] text-[12px] truncate">{v}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {competitorPrices.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Tags className="opacity-30 mx-auto mb-3 w-8 h-8 text-[#5F624F]" />
            <p className="font-black text-[#1F1F1A] text-sm">No competitor prices yet</p>
            <p className="mt-1 text-[#5F624F] text-[11px]">Tap the scan button below to pull local prices for {area}.</p>
          </div>
        ) : view === "byVenue" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse">
              <thead>
                <tr className="font-black text-[#5F624F]/60 text-[9px] uppercase tracking-widest">
                  <th className="px-4 sm:px-5 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-[#5C4033] text-right">You</th>
                  {matrix.venues.map((v) => (
                    <th key={v} className="px-2 py-2 max-w-32 font-black text-right truncate">{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => {
                  const comps = row.cells.filter((x): x is number => x != null);
                  const avg = comps.length ? comps.reduce((s, x) => s + x, 0) / comps.length : null;
                  const above = row.ownPrice != null && avg != null && row.ownPrice > avg;
                  return (
                    <tr key={row.key} className="border-[#E6DFC8]/60 border-t">
                      <td className="px-4 sm:px-5 py-2.5 font-bold text-[#1F1F1A] text-[13px] text-left">{row.label}</td>
                      <td
                        className={cn(
                          "px-2 py-2.5 font-black tabular-nums text-[13px] text-right",
                          row.ownPrice == null ? "text-[#5F624F]/40" : above ? "text-red-700" : "text-green-700",
                        )}
                      >
                        {formatGbp(row.ownPrice)}
                      </td>
                      {row.cells.map((c, i) => (
                        <td key={i} className="px-2 py-2.5 tabular-nums text-[#5F624F] text-[12px] text-right">
                          {c == null ? <span className="text-[#5F624F]/40">—</span> : formatGbp(c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {matrix.venues.length === 0 && (
              <p className="px-4 sm:px-5 py-4 text-[#5F624F]/70 text-[11px]">
                No venue could be matched to your benchmark items yet — try the Avg view or refresh prices.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E6DFC8]/60">
            {comparison.map((c) => {
              const vw = VERDICT_WORD[c.verdict];
              const hasData = c.sampleCount > 0 && c.competitorAvg != null;
              return (
                <div key={c.key} className="flex flex-col gap-2 px-4 sm:px-5 py-3">
                  <div className="flex justify-between items-baseline gap-3">
                    <p className="min-w-0 font-black text-[#1F1F1A] text-[12.5px]">
                      {c.label}
                      {c.ownItemName && (
                        <span className="ml-1 font-medium text-[#5F624F]/80 text-[10px]">· your {c.ownItemName}</span>
                      )}
                    </p>
                    <p className={cn("font-black tabular-nums text-[14px] whitespace-nowrap shrink-0", vw.text)}>
                      {formatGbp(c.ownPrice)}
                      {hasData && <span className="ml-1 text-[8.5px] uppercase tracking-widest">{vw.word}</span>}
                    </p>
                  </div>
                  {hasData ? (
                    <>
                      <RangeBar c={c} />
                      {/* Phone: compact one-line min · avg · max */}
                      <p className="sm:hidden tabular-nums text-[#5F624F] text-[10.5px]">
                        {formatGbp(c.competitorMin)} · avg{" "}
                        <span className="font-black text-[#1F1F1A]">{formatGbp(c.competitorAvg)}</span> ·{" "}
                        {formatGbp(c.competitorMax)}
                        <span className="opacity-55 ml-1">({c.sampleCount})</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-[#5F624F]/40 text-[10.5px]">No local data yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Raw competitor prices */}
      {competitorPrices.length > 0 && (
        <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="flex justify-between items-center gap-2 bg-[#F7F4EA] px-4 sm:px-5 py-3 w-full"
          >
            <span className="font-black text-[#5C4033] text-[11px] uppercase tracking-widest">
              All sourced prices ({competitorPrices.length})
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform", showRaw && "rotate-180")} />
          </button>
          {showRaw && (
            <div className="divide-y divide-[#E6DFC8]/60">
              {competitorPrices.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1F1F1A] text-[13px] truncate">{p.item_name}</p>
                    <p className="text-[#5F624F]/70 text-[10px] truncate">
                      {p.venue_name}
                      {p.item_type ? ` · ${p.item_type}` : ""}
                    </p>
                  </div>
                  <span className="font-black tabular-nums text-[#1F1F1A] text-[13px] shrink-0">
                    {p.price_text || formatGbp(p.price_amount)}
                  </span>
                  {p.source_url && (
                    <a
                      href={p.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Source for ${p.item_name} at ${p.venue_name}`}
                      title="View source"
                      className="text-[#5C4033] hover:text-[#5C4033]/70 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="opacity-60 pt-1 text-[#5F624F] text-[10px] text-center">
        Competitor prices are AI-estimated from live web search and matched to your menu by keyword. Treat as a guide, not gospel.
      </p>

      {/* Full-width live-AI scan button (mirrors the app's price-insights block) */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex justify-center items-center gap-2 bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-60 rounded-xl w-full h-12 font-black text-[11px] text-white uppercase tracking-widest active:scale-95 transition-colors"
      >
        {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {isRefreshing ? "Scanning local prices…" : "Live AI: local price insights"}
      </button>

      {isRefreshing && (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto w-7 h-7 text-[#5C4033] animate-spin" />
          <p className="mt-2 font-bold text-[#5F624F] text-[11px]">Reading the local price wind…</p>
        </div>
      )}

      {/* AI price-positioning idea cards */}
      {priceTrends.length > 0 ? (
        <div className="space-y-3">
          <p className="pt-1 font-black text-[#5C4033] text-[10px] uppercase tracking-widest">Pricing plays</p>
          {priceTrends.map((t) => (
            <TrendCard key={t.id} trend={t} pending={pendingTrendId === t.id} onSetState={onSetTrendState} />
          ))}
        </div>
      ) : (
        !isRefreshing && (
          <p className="opacity-60 text-[#5F624F] text-[10px] text-center">
            Tap the button for AI pricing plays tied to live local price data.
          </p>
        )
      )}

      <div className="pb-4" />
    </div>
  );
}
