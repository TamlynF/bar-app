"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { refreshTrendsAction, setTrendStateAction } from "./actions";
import { TrendCard } from "./trend-card";
import PricesClient from "../prices/prices-client";
import type { BenchmarkComparison } from "../lib/compare";
import type {
  CompetitorPrice,
  MarketingTrend,
  MenuItemLite,
  PriceBenchmark,
  TrendState,
} from "../lib/types";

type TrendTab = "ads" | "events" | "prices";

const TABS: { value: TrendTab; label: string; short: string; tilt: string }[] = [
  { value: "ads", label: "📣 Post ideas", short: "📣 Posts", tilt: "rotate-[-1deg]" },
  { value: "events", label: "🎪 Event ideas", short: "🎪 Events", tilt: "rotate-[0.6deg]" },
  { value: "prices", label: "🏆 The price-off", short: "🏆 Price-off", tilt: "rotate-[-0.5deg]" },
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
  menuItems,
  benchmarks,
}: {
  initialTrends: MarketingTrend[];
  area: string;
  lastRefresh: string | null;
  pricesRadius: string | null;
  pricesLastRefresh: string | null;
  comparison: BenchmarkComparison[];
  competitorPrices: CompetitorPrice[];
  menuItems: MenuItemLite[];
  benchmarks: PriceBenchmark[];
}) {
  const [trendTab, setTrendTab] = useState<TrendTab>("ads");
  const [showSaved, setShowSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startMutate] = useTransition();

  const savedTrends = initialTrends.filter((t) => t.state === "saved");
  const ignoredTrends = initialTrends.filter((t) => t.state === "ignored");
  const adsTrends = initialTrends.filter((t) => t.kind === "advertising" && t.state !== "ignored");
  const eventsTrends = initialTrends.filter((t) => t.kind === "event_idea" && t.state !== "ignored");
  const priceTrends = initialTrends.filter((t) => t.kind === "price" && t.state !== "ignored");
  const feed = trendTab === "ads" ? adsTrends : eventsTrends;

  const handleRefresh = () => {
    const kind: "advertising" | "event_idea" = trendTab === "ads" ? "advertising" : "event_idea";
    startRefresh(async () => {
      const result = await refreshTrendsAction(kind);
      if ("error" in result) {
        toast.error(result.error);
      } else if (result.added > 0) {
        toast.success(`Pinned up ${result.added} new idea${result.added === 1 ? "" : "s"}.`);
      } else {
        toast.info("Nothing new this time - the board is up to date.");
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

  const toggleExpanded = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const tabRow = (
    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2">
      {TABS.map((tab) => {
        const active = trendTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setTrendTab(tab.value);
              setShowSaved(false);
              setExpandedId(null);
            }}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-[11.5px] transition-colors sm:px-4.5 sm:text-[13px]",
              tab.tilt,
              active
                ? "bg-[#20231A] font-bold text-[#FFF4CC]"
                : "border-[1.5px] border-dashed border-[#5E6654] bg-white font-semibold text-[#5E6654] hover:bg-[#FFFEFA]",
            )}
          >
            <span className="sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  const pinButton = (className: string) => (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={cn(
        "flex items-center justify-center gap-2 bg-[#34451F] font-bold text-white transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:opacity-60",
        className,
      )}
    >
      {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden="true">📌</span>}
      {isRefreshing ? "Pinning up fresh ideas…" : "Pin up fresh ideas"}
    </button>
  );

  return (
    <div className="w-full space-y-3.5 px-2 py-3 sm:space-y-4.5 sm:px-4 sm:py-0 md:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[27px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#20231A] sm:text-[34px]">
            {trendTab === "prices" ? "The price-off" : "The noticeboard"}
          </h1>
          <p className="mt-1 text-[13px] leading-normal text-[#5E6654] sm:mt-1.5 sm:text-sm">
            {trendTab === "prices"
              ? `How your prices stack up against the locals. Near ${area}.`
              : `Ideas worth nicking, pinned up fresh each week. Near ${area}.`}
          </p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          {trendTab !== "prices" && pinButton("h-11 rounded-xl px-4.5 text-[13.5px]")}
          <button
            type="button"
            onClick={() => setShowSaved((s) => !s)}
            aria-pressed={showSaved}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 font-semibold text-[12.5px] transition-colors active:scale-[0.98]",
              showSaved
                ? "border-[#34451F] bg-[#34451F] text-white"
                : "border-[#D8D5C8] bg-white text-[#5E6654] hover:bg-[#FFFEFA]",
            )}
          >
            🗂 My keepers · {savedTrends.length}
          </button>
        </div>
      </div>

      {tabRow}

      {showSaved ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-[13px] text-[#34451F]">Everything you&apos;ve kept</p>
            <button
              type="button"
              onClick={() => setShowSaved(false)}
              className="font-semibold text-[12px] text-[#34451F] underline"
            >
              Back to the board
            </button>
          </div>

          {savedTrends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
              <p className="text-2xl" aria-hidden="true">
                🗂
              </p>
              <p className="mt-2 font-bold text-sm text-[#20231A]">Nothing kept yet</p>
              <p className="mt-1 text-[12px] text-[#5E6654]">
                Hit 📌 Keep on a note and it lands in here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
              {savedTrends.map((t, i) => (
                <TrendCard
                  key={t.id}
                  trend={t}
                  index={i}
                  pending={pendingId === t.id}
                  onSetState={setState}
                  expanded={expandedId === t.id}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
            </div>
          )}

          {ignoredTrends.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="font-semibold text-[12px] text-[#5E6654]">
                Binned ({ignoredTrends.length}) — put any of them back up
              </p>
              <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
                {ignoredTrends.map((t, i) => (
                  <TrendCard
                    key={t.id}
                    trend={t}
                    index={i}
                    pending={pendingId === t.id}
                    onSetState={setState}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : trendTab === "prices" ? (
        <PricesClient
          area={area}
          radius={pricesRadius}
          lastRefresh={pricesLastRefresh}
          comparison={comparison}
          competitorPrices={competitorPrices}
          menuItems={menuItems}
          benchmarks={benchmarks}
          priceTrends={priceTrends}
          onSetTrendState={setState}
          pendingTrendId={pendingId}
        />
      ) : (
        <>
          <div className="flex gap-2 sm:hidden">
            {pinButton("h-13 flex-1 rounded-[14px] text-[14.5px]")}
            <button
              type="button"
              onClick={() => setShowSaved(true)}
              className="flex h-13 shrink-0 items-center gap-1.5 rounded-[14px] border border-[#D8D5C8] bg-white px-3.5 font-semibold text-[12.5px] text-[#5E6654]"
            >
              🗂 {savedTrends.length}
            </button>
          </div>

          {isRefreshing && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#34451F]" />
              <p className="mt-2 font-semibold text-[12px] text-[#5E6654]">
                {trendTab === "ads"
                  ? "Doomscrolling so you don't have to…"
                  : "Peeking at everyone else's party…"}
              </p>
            </div>
          )}

          {feed.length === 0 && !isRefreshing ? (
            <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
              <p className="text-2xl" aria-hidden="true">
                📌
              </p>
              <p className="mt-2 font-bold text-sm text-[#20231A]">Nothing pinned up yet</p>
              <p className="mt-1 text-[12px] text-[#5E6654]">Smash the button above and the board fills up.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 items-start gap-4 px-0.5 pt-1 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
              {feed.map((t, i) => (
                <TrendCard
                  key={t.id}
                  trend={t}
                  index={i}
                  pending={pendingId === t.id}
                  onSetState={setState}
                  expanded={expandedId === t.id}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
            </div>
          )}

          <p className="pt-2 pb-4 text-center text-[12px] text-[#5E6654]/60">
            {`Pinned fresh on ${formatWhen(lastRefresh)} · found by AI from what's going round · always sense-check before acting.`}
          </p>
        </>
      )}
    </div>
  );
}
