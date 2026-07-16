"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Bookmark, RotateCcw, MapPin, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { refreshTrendsAction, setTrendStateAction } from "./actions";
import { TrendCard } from "./trend-card";
import PricesClient from "../prices/prices-client";
import type { BenchmarkComparison } from "../lib/compare";
import type { CompetitorPrice, MarketingTrend, TrendState } from "../lib/types";

type TrendTab = "ads" | "events" | "prices";
const TABS: { value: TrendTab; label: string }[] = [
  { value: "ads", label: "🔥 Ads" },
  { value: "events", label: "🎪 Events" },
  { value: "prices", label: "💷 Prices" },
];

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrendsClient({
  initialTrends,
  area,
  lastRefresh,
  pricesRadius,
  pricesLastRefresh,
  comparison,
  competitorPrices,
}: {
  initialTrends: MarketingTrend[];
  area: string;
  lastRefresh: string | null;
  pricesRadius: string | null;
  pricesLastRefresh: string | null;
  comparison: BenchmarkComparison[];
  competitorPrices: CompetitorPrice[];
}) {
  const [trendTab, setTrendTab] = useState<TrendTab>("ads");
  const [showSaved, setShowSaved] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startMutate] = useTransition();

  // Saved + ignored live in the Ideas view; the Ads/Events feeds show everything not ignored.
  const savedTrends = initialTrends.filter((t) => t.state === "saved");
  const ignoredTrends = initialTrends.filter((t) => t.state === "ignored");
  const adsTrends = initialTrends.filter((t) => t.kind === "advertising" && t.state !== "ignored");
  const eventsTrends = initialTrends.filter((t) => t.kind === "event_idea" && t.state !== "ignored");
  const priceTrends = initialTrends.filter((t) => t.kind === "price" && t.state !== "ignored");
  const feed = trendTab === "ads" ? adsTrends : eventsTrends;

  const handleRefresh = () => {
    // Only scan the tab you're on — ads → advertising, events → event ideas.
    const kind: "advertising" | "event_idea" = trendTab === "ads" ? "advertising" : "event_idea";
    startRefresh(async () => {
      const result = await refreshTrendsAction(kind);
      if ("error" in result) {
        toast.error(result.error);
      } else if (result.added > 0) {
        toast.success(`Added ${result.added} new trend${result.added === 1 ? "" : "s"}.`);
      } else {
        toast.info("No new trends this time — you're up to date.");
      }
    });
  };

  const setState = (id: string, state: TrendState) => {
    setPendingId(id);
    startMutate(async () => {
      const result = await setTrendStateAction(id, state);
      if ("error" in result) toast.error(result.error);
      setPendingId(null);
    });
  };

  return (
    <div className="max-w-3xl space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {/* Title + Ideas toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-black text-xl tracking-tight text-[#1F1F1A] uppercase">Trends</h1>
          <div className="mt-0.5 flex items-center gap-1.5 text-[#5F624F]">
            <MapPin className="h-3 w-3 shrink-0" />
            <p className="truncate font-black text-[10px] tracking-widest uppercase">Live AI · near {area}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSaved((s) => !s)}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 font-black text-[10px] tracking-widest uppercase transition-colors active:scale-95",
            showSaved
              ? "border-[#5C4033] bg-[#5C4033] text-white"
              : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]",
          )}
        >
          <Bookmark className="h-4 w-4" />
          Ideas ({savedTrends.length})
        </button>
      </div>

      {showSaved ? (
        /* Ideas view: saved trends + a restore list for ignored ones */
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="font-black text-[10px] tracking-widest text-[#5C4033] uppercase">My saved ideas</p>
            {savedTrends.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
                <Bookmark className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
                <p className="font-black text-sm text-[#1F1F1A]">Nothing saved yet</p>
                <p className="mt-1 text-[11px] text-[#5F624F]">Tap the bookmark on a trend to pin it here.</p>
              </div>
            ) : (
              savedTrends.map((t) => (
                <TrendCard key={t.id} trend={t} pending={pendingId === t.id} onSetState={setState} />
              ))
            )}
          </div>

          {ignoredTrends.length > 0 && (
            <div className="space-y-2">
              <p className="font-black text-[10px] tracking-widest text-[#5F624F]/70 uppercase">
                Ignored ({ignoredTrends.length})
              </p>
              {ignoredTrends.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#E6DFC8] bg-white px-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#5F624F]">{t.title}</p>
                  <button
                    type="button"
                    onClick={() => setState(t.id, "new")}
                    disabled={pendingId === t.id}
                    aria-label={`Restore ${t.title}`}
                    title="Restore"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA] active:scale-95 disabled:opacity-60"
                  >
                    {pendingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTrendTab(tab.value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-xl border font-black text-[11px] tracking-wide uppercase transition-colors active:scale-95",
                  trendTab === tab.value
                    ? "border-[#5C4033] bg-[#5C4033] text-white"
                    : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {trendTab === "prices" ? (
            <PricesClient
              area={area}
              radius={pricesRadius}
              lastRefresh={pricesLastRefresh}
              comparison={comparison}
              competitorPrices={competitorPrices}
              priceTrends={priceTrends}
              onSetTrendState={setState}
              pendingTrendId={pendingId}
            />
          ) : (
            <>
              {/* Full-width scan button + caption (mirrors the app's Trends scan block) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B4332] font-black text-[11px] tracking-widest text-white uppercase transition-colors hover:bg-[#1B4332]/85 active:scale-95 disabled:opacity-60"
                >
                  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {isRefreshing
                    ? "Scanning the internet…"
                    : feed.length
                      ? "Rescan for fresh trends"
                      : "Scan for live trends"}
                </button>
                <p className="text-[11px] leading-snug text-[#5F624F] opacity-70">
                  {trendTab === "ads"
                    ? "Reels/TikTok formats bars & venues are winning with right now — tied to current events & memes."
                    : "Events other UK bars, pubs, venues & hospitality spots are running right now."}
                </p>
                <p className="text-[10px] text-[#5F624F] tabular-nums opacity-50">
                  Last refreshed {formatWhen(lastRefresh)}
                </p>
              </div>

              {isRefreshing && (
                <div className="py-6 text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#5C4033]" />
                  <p className="mt-2 text-[11px] font-bold text-[#5F624F]">
                    {trendTab === "ads"
                      ? "Doomscrolling so you don't have to…"
                      : "Peeking at everyone else's party…"}
                  </p>
                </div>
              )}

              {feed.length === 0 && !isRefreshing ? (
                <div className="rounded-2xl border border-dashed border-[#E6DFC8] py-14 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#5F624F] opacity-30" />
                  <p className="font-black text-sm text-[#1F1F1A]">Nothing here yet</p>
                  <p className="mt-1 text-[11px] text-[#5F624F]">
                    Smash the scan button to pull live {trendTab === "ads" ? "ad" : "event"} trends.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feed.map((t) => (
                    <TrendCard key={t.id} trend={t} pending={pendingId === t.id} onSetState={setState} />
                  ))}
                </div>
              )}

              <p className="pt-2 pb-4 text-center text-[10px] text-[#5F624F] opacity-60">
                Trends are AI-generated from live web search and link to their sources. Always sense-check before acting.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
