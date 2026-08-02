"use client";

import { useState } from "react";
import { Loader2, Bookmark, BookmarkCheck, EyeOff, RotateCcw, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingTrend, TrendEffort, TrendKind, TrendState } from "../lib/types";

const KIND: Record<TrendKind, { emoji: string; label: string; text: string; tile: string }> = {
  advertising: { emoji: "🔥", label: "Ad / Social", text: "text-[#7C3AED]", tile: "bg-[#F3EBFE] border-[#E2D4FB]" },
  event_idea: { emoji: "🎪", label: "Event idea", text: "text-[#1D4ED8]", tile: "bg-[#EAF1FE] border-[#D3E1FC]" },
  price: { emoji: "💷", label: "Price play", text: "text-[#34451F]", tile: "bg-[#FDF1E3] border-[#F5DFC0]" },
};

const EFFORT: Record<TrendEffort, { bolts: string; note: string; text: string }> = {
  Easy: { bolts: "⚡", note: "one evening", text: "text-green-700" },
  Medium: { bolts: "⚡⚡", note: "a weekend", text: "text-[#34451F]" },
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
        "overflow-hidden rounded-2xl border bg-white transition-colors",
        open ? "border-[#34451F] shadow-[0_8px_24px_rgba(92,64,51,0.14)]" : "border-[#D8D5C8]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg", k.tile)}>
          <span aria-hidden="true">{k.emoji}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-black text-[13.5px] leading-snug text-[#20231A]">{trend.title}</span>
          <span className="flex items-center gap-2 font-black text-[8.5px] tracking-widest uppercase">
            <span className={k.text}>{k.label}</span>
            {e && (
              <span className={e.text}>
                {e.bolts} {trend.effort}
              </span>
            )}
            {!saved && !ignored && !open && (
              <span className="rounded bg-[#E0483C] px-1.5 py-0.5 tracking-wider text-white">New</span>
            )}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#5E6654] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 px-3 pb-3">
          {trend.summary && <p className="text-[12.5px] leading-relaxed text-[#5E6654]">{trend.summary}</p>}

          {trend.relevance && (
            <div className="rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2">
              <p className="mb-0.5 font-black text-[8.5px] tracking-widest text-[#34451F] uppercase">Why you</p>
              <p className="text-[12px] leading-snug text-[#20231A]">{trend.relevance}</p>
            </div>
          )}

          {trend.action && (
            <div className="rounded-xl border border-[#34451F]/20 bg-[#34451F]/[0.06] px-3 py-2">
              <p className="mb-0.5 font-black text-[8.5px] tracking-widest text-[#34451F] uppercase">Do this week</p>
              <p className="text-[12px] leading-snug text-[#20231A]">{trend.action}</p>
            </div>
          )}

          {e && (
            <p className="text-[10.5px] font-semibold text-[#5E6654] opacity-80">
              Effort: {e.bolts} {trend.effort} - roughly {e.note}.
            </p>
          )}

          {trend.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trend.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-medium text-[#5E6654]/70">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            {trend.source_url ? (
              <a
                href={trend.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-[#34451F] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{trend.source_name || "View source"}</span>
              </a>
            ) : (
              <span className="text-[11px] text-[#5E6654]/50">No source link</span>
            )}

            <div className="flex shrink-0 items-center gap-1.5">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#5E6654]" />
              ) : ignored ? (
                <button
                  type="button"
                  onClick={() => onSetState(trend.id, "new")}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-white px-3 font-black text-[9.5px] tracking-widest text-[#5E6654] uppercase transition-colors hover:bg-[#F4F1E8] active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSetState(trend.id, saved ? "new" : "saved")}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg border px-3 font-black text-[9.5px] tracking-widest uppercase transition-colors active:scale-95",
                      saved
                        ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        : "border-[#D8D5C8] bg-white text-[#5E6654] hover:bg-[#F4F1E8]",
                    )}
                  >
                    {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetState(trend.id, "ignored")}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-white px-3 font-black text-[9.5px] tracking-widest text-[#5E6654] uppercase transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-95"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
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
