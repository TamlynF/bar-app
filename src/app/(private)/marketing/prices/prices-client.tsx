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

const VERDICT_WORD: Record<Verdict, { word: string; text: string; dot: string }> = {
  above: { word: "above avg", text: "text-red-600", dot: "#DC2626" },
  below: { word: "below avg", text: "text-green-700", dot: "#15803D" },
  inline: { word: "in line", text: "text-[#B45309]", dot: "#B45309" },
  unknown: { word: "no data", text: "text-[#5F624F]/60", dot: "#8A8D7A" },
};

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
    <div className="hidden flex-col gap-1.5 sm:flex">
      <div className="relative h-3.5">
        <div className="absolute top-1.5 right-0 left-0 h-0.5 rounded bg-[#E6DFC8]" />
        <div
          className="absolute top-[5px] left-[var(--l)] h-1 w-[var(--w)] rounded bg-[#D9D2B8]"
          style={{ "--l": `${bandLeft}%`, "--w": `${bandWidth}%` } as React.CSSProperties}
        />
        <div
          className="absolute top-0.5 left-[var(--l)] h-2.5 w-0.5 -translate-x-px rounded bg-[#5F624F]"
          style={{ "--l": `${pct(avg)}%` } as React.CSSProperties}
        />
        {own != null && (
          <div
            className="absolute top-px left-[var(--l)] h-3 w-3 -translate-x-1.5 rounded-full border-2 border-white bg-[var(--dot)] shadow-[0_1px_4px_rgba(31,31,26,0.35)]"
            style={{ "--l": `${pct(own)}%`, "--dot": VERDICT_WORD[c.verdict].dot } as React.CSSProperties}
          />
        )}
      </div>
      <div className="flex justify-between text-[9.5px] text-[#5F624F] tabular-nums">
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

  const insights = comparison
    .filter((c) => c.ownPrice != null && c.competitorAvg != null && c.sampleCount > 0)
    .map((c) => ({ label: c.label, diff: (c.ownPrice as number) - (c.competitorAvg as number) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2);

  return (
    <div className="max-w-3xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      <section className="space-y-3 rounded-2xl border border-[#E6DFC8] bg-white p-4 sm:p-5">
        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5 text-[#5F624F]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="text-[11px] font-normal tracking-normal normal-case sm:hidden">{area}</p>
                <p className="hidden font-black text-[10px] tracking-widest uppercase sm:block">
                  Comparing {area}
                  {radius ? ` · ${radius}` : ""} · bars, pubs, music venues &amp; hospitality only
                </p>
              </div>
              <p className="mt-1 text-[11px] text-[#5F624F] tabular-nums opacity-70">
                Prices last refreshed {formatWhen(lastRefresh)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Change area"
              title="Change area"
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#B45309] px-4 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#B45309]/85 active:scale-95 max-sm:w-11 max-sm:justify-center max-sm:px-0"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Change area</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveArea} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-black text-[10px] tracking-widest text-[#5F624F] uppercase">Area / Town</span>
                <input
                  name="comparison_area"
                  defaultValue={area}
                  required
                  placeholder="e.g. Hinckley"
                  className="mt-1 h-11 w-full rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 text-sm font-bold text-[#1F1F1A] outline-none focus:border-[#5C4033]"
                />
              </label>
              <label className="block">
                <span className="font-black text-[10px] tracking-widest text-[#5F624F] uppercase">Radius (optional)</span>
                <input
                  name="comparison_radius"
                  defaultValue={radius ?? ""}
                  placeholder="e.g. 5 miles"
                  className="mt-1 h-11 w-full rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] px-3 text-sm font-bold text-[#1F1F1A] outline-none focus:border-[#5C4033]"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="h-11 rounded-xl border border-[#E6DFC8] bg-white px-4 font-black text-[10px] tracking-widest text-[#5F624F] uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#1B4332] px-5 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
            <p className="text-[10px] text-[#5F624F] opacity-70">
              Changing the area? Hit Refresh afterwards to pull prices for the new location.
            </p>
          </form>
        )}
      </section>

      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((ins) => (
            <span
              key={ins.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-black text-[11px] tracking-wide uppercase",
                ins.diff > 0
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700",
              )}
            >
              {ins.diff > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              {ins.label}: you&apos;re {formatGbp(Math.abs(ins.diff))} {ins.diff > 0 ? "above" : "below"} local avg
            </span>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#E6DFC8] bg-[#F7F4EA] px-4 py-3 sm:px-5">
          <p className="font-black text-[11px] tracking-widest text-[#5C4033] uppercase">Your menu vs local venues</p>
          {competitorPrices.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {(["summary", "byVenue"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setView(m)}
                  className={cn(
                    "h-7 rounded-lg border px-2.5 font-black text-[9px] tracking-widest uppercase transition-colors",
                    view === m
                      ? "border-[#5C4033] bg-[#5C4033] text-white"
                      : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-white/60",
                  )}
                >
                  {m === "summary" ? "Avg" : "By venue"}
                </button>
              ))}

              {view === "byVenue" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVenuePickerOpen((o) => !o)}
                    aria-label="Choose venues"
                    title="Choose venues"
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                      venuePickerOpen
                        ? "border-[#5C4033] bg-[#5C4033] text-white"
                        : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-white/60",
                    )}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {venuePickerOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setVenuePickerOpen(false)} aria-hidden="true" />
                      <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-[#E6DFC8] bg-white shadow-lg">
                        <div className="flex items-center justify-between gap-2 border-b border-[#E6DFC8] bg-[#F7F4EA] px-3 py-2">
                          <span className="font-black text-[9px] tracking-widest text-[#5C4033] uppercase">
                            Show venues ({shownVenues.length}/{MAX_VENUES})
                          </span>
                          {pickedVenues != null && (
                            <button
                              type="button"
                              onClick={() => setPickedVenues(null)}
                              className="font-black text-[9px] tracking-widest text-[#5F624F] uppercase hover:text-[#5C4033]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        {allVenues.length === 0 ? (
                          <p className="px-3 py-4 text-[11px] text-[#5F624F]/70">No venues to choose yet — refresh prices first.</p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto p-1">
                            {allVenues.map((v) => {
                              const checked = shownVenues.includes(v);
                              const atCap = shownVenues.length >= MAX_VENUES;
                              return (
                                <label
                                  key={v}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5",
                                    !checked && atCap ? "cursor-not-allowed opacity-40" : "hover:bg-[#F7F4EA]",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!checked && atCap}
                                    onChange={() => toggleVenue(v)}
                                    className="h-3.5 w-3.5 shrink-0 accent-[#5C4033]"
                                  />
                                  <span className="min-w-0 truncate text-[12px] font-bold text-[#1F1F1A]">{v}</span>
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
            <Tags className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
            <p className="font-black text-sm text-[#1F1F1A]">No competitor prices yet</p>
            <p className="mt-1 text-[11px] text-[#5F624F]">Tap the scan button below to pull local prices for {area}.</p>
          </div>
        ) : view === "byVenue" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 border-collapse">
              <thead>
                <tr className="font-black text-[9px] tracking-widest text-[#5F624F]/60 uppercase">
                  <th className="px-4 py-2 text-left sm:px-5">Item</th>
                  <th className="px-2 py-2 text-right text-[#5C4033]">You</th>
                  {matrix.venues.map((v) => (
                    <th key={v} className="max-w-32 truncate px-2 py-2 text-right font-black">{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => {
                  const comps = row.cells.filter((x): x is number => x != null);
                  const avg = comps.length ? comps.reduce((s, x) => s + x, 0) / comps.length : null;
                  const above = row.ownPrice != null && avg != null && row.ownPrice > avg;
                  return (
                    <tr key={row.key} className="border-t border-[#E6DFC8]/60">
                      <td className="px-4 py-2.5 text-left text-[13px] font-bold text-[#1F1F1A] sm:px-5">{row.label}</td>
                      <td
                        className={cn(
                          "px-2 py-2.5 text-right font-black text-[13px] tabular-nums",
                          row.ownPrice == null ? "text-[#5F624F]/40" : above ? "text-red-700" : "text-green-700",
                        )}
                      >
                        {formatGbp(row.ownPrice)}
                      </td>
                      {row.cells.map((c, i) => (
                        <td key={i} className="px-2 py-2.5 text-right text-[12px] text-[#5F624F] tabular-nums">
                          {c == null ? <span className="text-[#5F624F]/40">—</span> : formatGbp(c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {matrix.venues.length === 0 && (
              <p className="px-4 py-4 text-[11px] text-[#5F624F]/70 sm:px-5">
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
                <div key={c.key} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 font-black text-[12.5px] text-[#1F1F1A]">
                      {c.label}
                      {c.ownItemName && (
                        <span className="ml-1 text-[10px] font-medium text-[#5F624F]/80">· your {c.ownItemName}</span>
                      )}
                    </p>
                    <p className={cn("shrink-0 font-black text-[14px] whitespace-nowrap tabular-nums", vw.text)}>
                      {formatGbp(c.ownPrice)}
                      {hasData && <span className="ml-1 text-[8.5px] tracking-widest uppercase">{vw.word}</span>}
                    </p>
                  </div>
                  {hasData ? (
                    <>
                      <RangeBar c={c} />
                      <p className="text-[10.5px] text-[#5F624F] tabular-nums sm:hidden">
                        {formatGbp(c.competitorMin)} · avg{" "}
                        <span className="font-black text-[#1F1F1A]">{formatGbp(c.competitorAvg)}</span> ·{" "}
                        {formatGbp(c.competitorMax)}
                        <span className="ml-1 opacity-55">({c.sampleCount})</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-[10.5px] text-[#5F624F]/40">No local data yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {competitorPrices.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#E6DFC8] bg-white">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="flex w-full items-center justify-between gap-2 bg-[#F7F4EA] px-4 py-3 sm:px-5"
          >
            <span className="font-black text-[11px] tracking-widest text-[#5C4033] uppercase">
              All sourced prices ({competitorPrices.length})
            </span>
            <ChevronDown className={cn("h-4 w-4 text-[#5F624F] transition-transform", showRaw && "rotate-180")} />
          </button>
          {showRaw && (
            <div className="divide-y divide-[#E6DFC8]/60">
              {competitorPrices.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1F1F1A]">{p.item_name}</p>
                    <p className="truncate text-[10px] text-[#5F624F]/70">
                      {p.venue_name}
                      {p.item_type ? ` · ${p.item_type}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-black text-[13px] text-[#1F1F1A] tabular-nums">
                    {p.price_text || formatGbp(p.price_amount)}
                  </span>
                  {p.source_url && (
                    <a
                      href={p.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Source for ${p.item_name} at ${p.venue_name}`}
                      title="View source"
                      className="shrink-0 text-[#5C4033] hover:text-[#5C4033]/70"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="pt-1 text-center text-[10px] text-[#5F624F] opacity-60">
        Competitor prices are AI-estimated from live web search and matched to your menu by keyword. Treat as a guide, not gospel.
      </p>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B4332] font-black text-[11px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85 active:scale-95 disabled:opacity-60"
      >
        {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {isRefreshing ? "Scanning local prices…" : "Live AI: local price insights"}
      </button>

      {isRefreshing && (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#5C4033]" />
          <p className="mt-2 text-[11px] font-bold text-[#5F624F]">Reading the local price wind…</p>
        </div>
      )}

      {priceTrends.length > 0 ? (
        <div className="space-y-3">
          <p className="pt-1 font-black text-[10px] tracking-widest text-[#5C4033] uppercase">Pricing plays</p>
          {priceTrends.map((t) => (
            <TrendCard key={t.id} trend={t} pending={pendingTrendId === t.id} onSetState={onSetTrendState} />
          ))}
        </div>
      ) : (
        !isRefreshing && (
          <p className="text-center text-[10px] text-[#5F624F] opacity-60">
            Tap the button for AI pricing plays tied to live local price data.
          </p>
        )
      )}

      <div className="pb-4" />
    </div>
  );
}
