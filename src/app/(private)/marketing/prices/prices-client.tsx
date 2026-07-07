"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw,
  Loader2,
  Pencil,
  Save,
  MapPin,
  Tags,
  ChevronDown,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGbp } from "@/lib/price";
import { refreshPricesAction, updateComparisonAreaAction } from "./actions";
import type { BenchmarkComparison, Verdict } from "../lib/compare";
import type { CompetitorPrice } from "../lib/types";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VERDICT: Record<Verdict, { label: string; chip: string; Icon: typeof ArrowUp }> = {
  above: { label: "Above avg", chip: "text-red-600 bg-red-50 border-red-200", Icon: ArrowUp },
  below: { label: "Below avg", chip: "text-green-700 bg-green-50 border-green-200", Icon: ArrowDown },
  inline: { label: "In line", chip: "text-[#5C4033] bg-[#F7F4EA] border-[#E6DFC8]", Icon: Minus },
  unknown: { label: "No data", chip: "text-[#5F624F] bg-white border-[#E6DFC8]", Icon: Minus },
};

export default function PricesClient({
  area,
  radius,
  lastRefresh,
  comparison,
  competitorPrices,
}: {
  area: string;
  radius: string | null;
  lastRefresh: string | null;
  comparison: BenchmarkComparison[];
  competitorPrices: CompetitorPrice[];
}) {
  const [isRefreshing, startRefresh] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const handleRefresh = () => {
    startRefresh(async () => {
      const result = await refreshPricesAction();
      if ("error" in result) toast.error(result.error);
      else toast.success(`Updated ${result.count} competitor price${result.count === 1 ? "" : "s"}.`);
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

  return (
    <div className="px-2 py-3 sm:px-4 md:px-6 sm:py-0 space-y-3 sm:space-y-4 max-w-3xl">
      {/* Area + refresh */}
      <section className="bg-white border border-[#E6DFC8] rounded-2xl p-4 sm:p-5 space-y-3">
        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[#5F624F]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest truncate">
                  Comparing against {area}
                  {radius ? ` · ${radius}` : ""}
                </p>
              </div>
              <p className="text-[11px] text-[#5F624F] opacity-70 mt-1 tabular-nums">
                Prices last refreshed {formatWhen(lastRefresh)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="h-11 px-4 rounded-xl bg-[#B45309] hover:bg-[#B45309]/85 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-colors active:scale-95 shrink-0"
            >
              <Pencil className="w-4 h-4" />
              Area
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-11 px-5 rounded-xl bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-60 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-colors active:scale-95 shrink-0"
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isRefreshing ? "Checking…" : "Refresh"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveArea} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">Area / Town</span>
                <input
                  name="comparison_area"
                  defaultValue={area}
                  required
                  placeholder="e.g. Hinckley"
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] text-sm font-bold text-[#1F1F1A] outline-none focus:border-[#5C4033]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5F624F]">Radius (optional)</span>
                <input
                  name="comparison_radius"
                  defaultValue={radius ?? ""}
                  placeholder="e.g. 5 miles"
                  className="mt-1 w-full h-11 px-3 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] text-sm font-bold text-[#1F1F1A] outline-none focus:border-[#5C4033]"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="h-11 px-4 rounded-xl border border-[#E6DFC8] bg-white text-[#5F624F] font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 px-5 rounded-xl bg-[#1B4332] hover:bg-[#1B4332]/85 disabled:opacity-60 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
            <p className="text-[10px] text-[#5F624F] opacity-70">
              Changing the area? Hit Refresh afterwards to pull prices for the new location.
            </p>
          </form>
        )}
      </section>

      {/* Comparison */}
      <section className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
        <div className="bg-[#F7F4EA] px-4 sm:px-5 py-3 border-b border-[#E6DFC8]">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#5C4033]">Your menu vs local venues</p>
        </div>

        {competitorPrices.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Tags className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
            <p className="text-sm font-black text-[#1F1F1A]">No competitor prices yet</p>
            <p className="text-[11px] text-[#5F624F] mt-1">Hit Refresh to pull local prices for {area}.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6DFC8]/60">
            {/* header row */}
            <div className="hidden sm:grid grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr] gap-2 px-5 py-2 text-[9px] font-black uppercase tracking-widest text-[#5F624F]/60">
              <span>Item</span>
              <span className="text-right">Your price</span>
              <span className="text-right">Local min · avg · max</span>
              <span className="text-right">Vs avg</span>
            </div>
            {comparison.map((c) => {
              const v = VERDICT[c.verdict];
              return (
                <div key={c.key} className="grid grid-cols-2 sm:grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr] gap-2 px-4 sm:px-5 py-3 items-center">
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <p className="text-[13px] font-black text-[#1F1F1A] truncate">{c.label}</p>
                    {c.ownItemName && (
                      <p className="text-[10px] text-[#5F624F]/70 truncate">Your: {c.ownItemName}</p>
                    )}
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="sm:hidden text-[9px] font-black uppercase tracking-widest text-[#5F624F]/50 mr-1">You</span>
                    <span className="text-[13px] font-black text-[#1F1F1A]">{formatGbp(c.ownPrice)}</span>
                  </div>
                  <div className="text-right tabular-nums text-[12px] text-[#5F624F]">
                    {c.sampleCount > 0 ? (
                      <span>
                        {formatGbp(c.competitorMin)} · <span className="font-black text-[#1F1F1A]">{formatGbp(c.competitorAvg)}</span> · {formatGbp(c.competitorMax)}
                        <span className="text-[9px] text-[#5F624F]/50 ml-1">({c.sampleCount})</span>
                      </span>
                    ) : (
                      <span className="text-[#5F624F]/40">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border", v.chip)}>
                      <v.Icon className="w-3 h-3" />
                      {v.label}
                    </span>
                  </div>
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
            className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-[#F7F4EA]"
          >
            <span className="text-[11px] font-black uppercase tracking-widest text-[#5C4033]">
              All sourced prices ({competitorPrices.length})
            </span>
            <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform", showRaw && "rotate-180")} />
          </button>
          {showRaw && (
            <div className="divide-y divide-[#E6DFC8]/60">
              {competitorPrices.map((p) => (
                <div key={p.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#1F1F1A] truncate">{p.item_name}</p>
                    <p className="text-[10px] text-[#5F624F]/70 truncate">
                      {p.venue_name}
                      {p.item_type ? ` · ${p.item_type}` : ""}
                    </p>
                  </div>
                  <span className="text-[13px] font-black text-[#1F1F1A] tabular-nums shrink-0">
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

      <p className="text-[10px] text-[#5F624F] opacity-60 text-center pt-2 pb-4">
        Competitor prices are AI-estimated from live web search and matched to your menu by keyword. Treat as a guide, not gospel.
      </p>
    </div>
  );
}
