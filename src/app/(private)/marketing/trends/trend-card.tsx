"use client";

import { useState } from "react";
import { Loader2, Bookmark, BookmarkCheck, EyeOff, RotateCcw, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingTrend, TrendEffort, TrendKind, TrendState } from "../lib/types";

// Kind → emoji tile + label + colour (matches the Marketing Trends design).
const KIND: Record<TrendKind, { emoji: string; label: string; text: string; tile: string }> = {
  advertising: { emoji: "🔥", label: "Ad / Social", text: "text-[#7C3AED]", tile: "bg-[#F3EBFE] border-[#E2D4FB]" },
  event_idea: { emoji: "🎪", label: "Event idea", text: "text-[#1D4ED8]", tile: "bg-[#EAF1FE] border-[#D3E1FC]" },
  price: { emoji: "💷", label: "Price play", text: "text-[#B45309]", tile: "bg-[#FDF1E3] border-[#F5DFC0]" },
};

// Effort → ⚡ bolts + rough time + colour.
const EFFORT: Record<TrendEffort, { bolts: string; note: string; text: string }> = {
  Easy: { bolts: "⚡", note: "one evening", text: "text-green-700" },
  Medium: { bolts: "⚡⚡", note: "a weekend", text: "text-[#B45309]" },
  Big: { bolts: "⚡⚡⚡", note: "a project", text: "text-red-600" },
};

export function TrendCard({
  trend,
  pending,
  onSetState,
}: {
  trend: MarketingTrend;
  pending: boolean;
  onSetState: (id: string, state: TrendState) => void;
}) {
  const [open, setOpen] = useState(false);
  const k = KIND[trend.kind];
  const e = trend.effort ? EFFORT[trend.effort] : null;
  const saved = trend.state === "saved";
  const ignored = trend.state === "ignored";

  return (
    <article
      className={cn(
        "bg-white border rounded-2xl overflow-hidden transition-colors",
        open ? "border-[#5C4033] shadow-[0_8px_24px_rgba(92,64,51,0.14)]" : "border-[#E6DFC8]",
      )}
    >
      {/* Collapsed head — tap to expand */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 p-3 w-full text-left"
      >
        <span className={cn("flex items-center justify-center border rounded-xl w-10 h-10 text-lg shrink-0", k.tile)}>
          <span aria-hidden="true">{k.emoji}</span>
        </span>
        <span className="flex flex-col flex-1 gap-1 min-w-0">
          <span className="font-black text-[#1F1F1A] text-[13.5px] leading-snug line-clamp-2">{trend.title}</span>
          <span className="flex items-center gap-2 font-black text-[8.5px] uppercase tracking-widest">
            <span className={k.text}>{k.label}</span>
            {e && (
              <span className={e.text}>
                {e.bolts} {trend.effort}
              </span>
            )}
            {!saved && !ignored && !open && (
              <span className="bg-[#E0483C] px-1.5 py-0.5 rounded text-white tracking-wider">New</span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="flex flex-col gap-2.5 px-3 pb-3">
          {trend.summary && <p className="text-[#5F624F] text-[12.5px] leading-relaxed">{trend.summary}</p>}

          {trend.relevance && (
            <div className="bg-[#F7F4EA] px-3 py-2 border border-[#E6DFC8] rounded-xl">
              <p className="mb-0.5 font-black text-[#5C4033] text-[8.5px] uppercase tracking-widest">Why you</p>
              <p className="text-[#1F1F1A] text-[12px] leading-snug">{trend.relevance}</p>
            </div>
          )}

          {trend.action && (
            <div className="bg-[#1B4332]/[0.06] px-3 py-2 border border-[#1B4332]/20 rounded-xl">
              <p className="mb-0.5 font-black text-[#1B4332] text-[8.5px] uppercase tracking-widest">Do this week</p>
              <p className="text-[#1F1F1A] text-[12px] leading-snug">{trend.action}</p>
            </div>
          )}

          {e && (
            <p className="opacity-80 font-semibold text-[#5F624F] text-[10.5px]">
              Effort: {e.bolts} {trend.effort} — roughly {e.note}.
            </p>
          )}

          {trend.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trend.tags.map((tag) => (
                <span key={tag} className="font-medium text-[#5F624F]/70 text-[10px]">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center gap-2 pt-0.5">
            {trend.source_url ? (
              <a
                href={trend.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-w-0 font-bold text-[#5C4033] text-[11px] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{trend.source_name || "View source"}</span>
              </a>
            ) : (
              <span className="text-[#5F624F]/50 text-[11px]">No source link</span>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              {pending ? (
                <Loader2 className="w-4 h-4 text-[#5F624F] animate-spin" />
              ) : ignored ? (
                <button
                  type="button"
                  onClick={() => onSetState(trend.id, "new")}
                  className="flex items-center gap-1.5 bg-white hover:bg-[#F7F4EA] px-3 border border-[#E6DFC8] rounded-lg h-8 font-black text-[#5F624F] text-[9.5px] uppercase tracking-widest active:scale-95 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSetState(trend.id, saved ? "new" : "saved")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 border rounded-lg h-8 font-black text-[9.5px] uppercase tracking-widest active:scale-95 transition-colors",
                      saved
                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        : "bg-white border-[#E6DFC8] text-[#5F624F] hover:bg-[#F7F4EA]",
                    )}
                  >
                    {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetState(trend.id, "ignored")}
                    className="flex items-center gap-1.5 bg-white hover:bg-red-50 px-3 border border-[#E6DFC8] hover:border-red-200 rounded-lg h-8 font-black text-[#5F624F] hover:text-red-500 text-[9.5px] uppercase tracking-widest active:scale-95 transition-colors"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Ignore
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
