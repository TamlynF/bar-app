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
    <div className="px-2 py-3 sm:px-4 md:px-6 sm:py-0 space-y-3 sm:space-y-4 max-w-3xl">
      {/* Title + Ideas toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-[#1F1F1A] uppercase tracking-tight">Trends</h1>
          <div className="flex items-center gap-1.5 text-[#5F624F] mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <p className="text-[10px] font-black uppercase tracking-widest truncate">Live AI · near {area}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSaved((s) => !s)}
          className={cn(
            "h-11 px-4 rounded-xl border font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-colors active:scale-95 shrink-0",
            showSaved
              ? "bg-[#5C4033] border-[#5C4033] text-white"
              : "bg-white border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA]",
          )}
        >
          <Bookmark className="w-4 h-4" />
          Ideas ({savedTrends.length})
        </button>
      </div>

      {showSaved ? (
        /* Ideas view: saved trends + a restore list for ignored ones */
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#5C4033]">My saved ideas</p>
            {savedTrends.length === 0 ? (
              <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
                <Bookmark className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
                <p className="text-sm font-black text-[#1F1F1A]">Nothing saved yet</p>
                <p className="text-[11px] text-[#5F624F] mt-1">Tap the bookmark on a trend to pin it here.</p>
              </div>
            ) : (
              savedTrends.map((t) => (
                <TrendCard key={t.id} trend={t} pending={pendingId === t.id} onSetState={setState} />
              ))
            )}
          </div>

          {ignoredTrends.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]/70">
                Ignored ({ignoredTrends.length})
              </p>
              {ignoredTrends.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-white border border-[#E6DFC8] rounded-xl px-3 py-2.5">
                  <p className="flex-1 min-w-0 text-[12px] font-bold text-[#5F624F] truncate">{t.title}</p>
                  <button
                    type="button"
                    onClick={() => setState(t.id, "new")}
                    disabled={pendingId === t.id}
                    aria-label={`Restore ${t.title}`}
                    title="Restore"
                    className="h-8 px-3 rounded-lg border border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA] disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 transition-colors active:scale-95"
                  >
                    {pendingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
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
                  "h-11 rounded-xl border font-black uppercase tracking-wide text-[11px] flex items-center justify-center gap-1.5 transition-colors active:scale-95",
                  trendTab === tab.value
                    ? "bg-[#5C4033] border-[#5C4033] text-white"
                    : "bg-white border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA]",
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
                  className="w-full h-12 rounded-xl bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-60 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-colors active:scale-95"
                >
                  {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isRefreshing
                    ? "Scanning the internet…"
                    : feed.length
                      ? "Rescan for fresh trends"
                      : "Scan for live trends"}
                </button>
                <p className="text-[11px] text-[#5F624F] opacity-70 leading-snug">
                  {trendTab === "ads"
                    ? "Reels/TikTok formats bars & venues are winning with right now — tied to current events & memes."
                    : "Events other UK bars, pubs, venues & hospitality spots are running right now."}
                </p>
                <p className="text-[10px] text-[#5F624F] opacity-50 tabular-nums">
                  Last refreshed {formatWhen(lastRefresh)}
                </p>
              </div>

              {isRefreshing && (
                <div className="text-center py-6">
                  <Loader2 className="w-7 h-7 animate-spin text-[#5C4033] mx-auto" />
                  <p className="text-[11px] font-bold text-[#5F624F] mt-2">
                    {trendTab === "ads"
                      ? "Doomscrolling so you don't have to…"
                      : "Peeking at everyone else's party…"}
                  </p>
                </div>
              )}

              {feed.length === 0 && !isRefreshing ? (
                <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
                  <Sparkles className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
                  <p className="text-sm font-black text-[#1F1F1A]">Nothing here yet</p>
                  <p className="text-[11px] text-[#5F624F] mt-1">
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

              <p className="text-[10px] text-[#5F624F] opacity-60 text-center pt-2 pb-4">
                Trends are AI-generated from live web search and link to their sources. Always sense-check before acting.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
