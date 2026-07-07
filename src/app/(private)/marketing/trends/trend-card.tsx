"use client";

import {
  Loader2,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  RotateCcw,
  ExternalLink,
  TrendingUp,
  CalendarHeart,
  PoundSterling,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingTrend, TrendEffort, TrendState } from "../lib/types";

const EFFORT_CHIP: Record<TrendEffort, string> = {
  Easy: "text-green-700 bg-green-50 border-green-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  Big: "text-red-600 bg-red-50 border-red-200",
};

function kindMeta(kind: MarketingTrend["kind"]) {
  if (kind === "advertising")
    return { label: "Ad / Social", Icon: TrendingUp, chip: "text-purple-700 bg-purple-50 border-purple-200" };
  if (kind === "price")
    return { label: "Price", Icon: PoundSterling, chip: "text-orange-700 bg-orange-50 border-orange-200" };
  return { label: "Event Idea", Icon: CalendarHeart, chip: "text-blue-700 bg-blue-50 border-blue-200" };
}

export function TrendCard({
  trend,
  pending,
  onSetState,
}: {
  trend: MarketingTrend;
  pending: boolean;
  onSetState: (id: string, state: TrendState) => void;
}) {
  const { label, Icon, chip } = kindMeta(trend.kind);

  return (
    <article className="bg-white border border-[#E6DFC8] rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", chip)}>
          <Icon className="w-3 h-3" />
          {label}
        </span>
        {(trend.effort || trend.category) && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
              trend.effort ? EFFORT_CHIP[trend.effort] : "text-[#5F624F] bg-[#F7F4EA] border-[#E6DFC8]",
            )}
          >
            <Zap className="w-3 h-3" />
            {[trend.effort, trend.category?.replace(/_/g, " ")].filter(Boolean).join(" - ")}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-black text-[#1F1F1A] leading-snug">{trend.title}</h3>
        {trend.summary && (
          <p className="text-[13px] text-[#5F624F] mt-1 leading-relaxed">{trend.summary}</p>
        )}
      </div>

      {trend.relevance && (
        <div className="bg-[#F7F4EA] border border-[#E6DFC8] rounded-xl px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#5C4033] mb-0.5">Why it matters</p>
          <p className="text-[12px] text-[#1F1F1A] leading-snug">{trend.relevance}</p>
        </div>
      )}

      {trend.action && (
        <div className="bg-[#1B4332]/5 border border-[#1B4332]/20 rounded-xl px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#1B4332] mb-0.5">Do this week</p>
          <p className="text-[12px] text-[#1F1F1A] leading-snug">{trend.action}</p>
        </div>
      )}

      {trend.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {trend.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium text-[#5F624F]/70">#{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {trend.source_url ? (
          <a
            href={trend.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5C4033] hover:underline min-w-0"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{trend.source_name || "View source"}</span>
          </a>
        ) : (
          <span className="text-[11px] text-[#5F624F]/50">No source link</span>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#5F624F]" />
          ) : (
            <TrendActions state={trend.state} onSetState={(s) => onSetState(trend.id, s)} />
          )}
        </div>
      </div>
    </article>
  );
}

function TrendActions({
  state,
  onSetState,
}: {
  state: TrendState;
  onSetState: (state: TrendState) => void;
}) {
  const iconBtn =
    "w-9 h-9 rounded-lg border flex items-center justify-center transition-colors active:scale-95";

  if (state === "ignored") {
    return (
      <button
        type="button"
        onClick={() => onSetState("new")}
        aria-label="Restore trend"
        title="Restore"
        className={cn(iconBtn, "border-[#E6DFC8] text-[#5F624F] bg-white hover:bg-[#F7F4EA]")}
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onSetState(state === "saved" ? "new" : "saved")}
        aria-label={state === "saved" ? "Unsave trend" : "Save trend"}
        title={state === "saved" ? "Saved" : "Save"}
        className={cn(
          iconBtn,
          state === "saved"
            ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
            : "border-[#E6DFC8] text-[#5F624F] bg-white hover:bg-[#F7F4EA]",
        )}
      >
        {state === "saved" ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => onSetState("ignored")}
        aria-label="Ignore trend"
        title="Ignore"
        className={cn(iconBtn, "border-[#E6DFC8] text-[#5F624F] bg-white hover:bg-red-50 hover:text-red-500 hover:border-red-200")}
      >
        <EyeOff className="w-4 h-4" />
      </button>
    </>
  );
}
