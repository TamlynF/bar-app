"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingTrend, TrendEffort, TrendKind, TrendState } from "../lib/types";

const KIND_CHIP: Record<TrendKind, string> = {
  advertising: "📣 Post idea",
  event_idea: "🎪 Event idea",
  price: "💷 Price play",
};

// No emoji field on the trend, so pick a stable one per note from a small
// on-theme pool - the board looks hand-made rather than three repeated icons.
const KIND_EMOJI: Record<TrendKind, string[]> = {
  advertising: ["📣", "📱", "🎬", "😅", "🔥"],
  event_idea: ["🎪", "🎤", "🎯", "🎲", "🕺"],
  price: ["💷", "🍺", "🏷️", "⚖️", "🧾"],
};

const EFFORT: Record<TrendEffort, { label: string; time: string; chip: string }> = {
  Easy: { label: "Easy", time: "~ one evening", chip: "bg-[#E7F3EC] text-[#22613F]" },
  Medium: { label: "Medium", time: "~ a weekend", chip: "bg-[#FFF4D6] text-[#9A5B00]" },
  Big: { label: "Hard", time: "~ a full week", chip: "bg-[#FDECEA] text-[#B33A32]" },
};

const NOTE_BG = ["bg-[#FFF7D6]", "bg-[#FFFEFA]", "bg-[#EDF3E2]"];
const NOTE_ROTATION = ["rotate-[-1.6deg]", "rotate-[1.8deg]"];

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// The AI usually returns one paragraph; numbered or bulleted text becomes steps.
export function actionSteps(action: string | null): string[] {
  const text = action?.trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  const numbered = text
    .split(/(?:^|\s)\d+[.)]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  return [text];
}

function Pin() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-2.25 left-1/2 h-4.5 w-4.5 -translate-x-1/2 rounded-full bg-[#B33A32] shadow-[inset_-2px_-3px_4px_rgba(0,0,0,0.3),0_2px_3px_rgba(0,0,0,0.3)]"
    />
  );
}

function EffortChips({ trend, size }: { trend: MarketingTrend; size: "note" | "open" }) {
  const e = trend.effort ? EFFORT[trend.effort] : null;
  if (!e) return null;
  const pill = size === "open" ? "px-3 py-1 text-[12px]" : "px-2.5 py-0.5 text-[11px]";
  return (
    <>
      <span className={cn("rounded-full font-bold", pill, e.chip)}>● {e.label}</span>
      <span className={cn("rounded-full bg-[#20231A]/8 font-semibold text-[#20231A]", pill)}>
        🕐 {e.time}
      </span>
    </>
  );
}

export function TrendCard({
  trend,
  pending,
  onSetState,
  expanded = false,
  onToggleExpanded,
  index = 0,
}: {
  trend: MarketingTrend;
  pending: boolean;
  onSetState: (id: string, state: TrendState) => void;
  expanded?: boolean;
  onToggleExpanded?: (id: string) => void;
  index?: number;
}) {
  const saved = trend.state === "saved";
  const ignored = trend.state === "ignored";
  const pool = KIND_EMOJI[trend.kind];
  const emoji = pool[hashOf(trend.id) % pool.length];
  const bg = NOTE_BG[(index + hashOf(trend.id)) % NOTE_BG.length];
  const rotation = NOTE_ROTATION[index % NOTE_ROTATION.length];
  const steps = actionSteps(trend.action);

  // The whole note is the toggle, so anything interactive inside it has to keep
  // its click to itself.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const toggleProps = onToggleExpanded
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-expanded": expanded,
        onClick: () => onToggleExpanded(trend.id),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded(trend.id);
          }
        },
      }
    : {};

  const keepButton = (className: string) => (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        onSetState(trend.id, saved ? "new" : "saved");
      }}
      disabled={pending}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg bg-[#34451F] font-bold text-white transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:opacity-60",
        className,
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span aria-hidden="true">📌</span>}
      {saved ? "Kept" : "Keep"}
    </button>
  );

  const binButton = (label: string, className: string) => (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        onSetState(trend.id, "ignored");
      }}
      disabled={pending}
      className={cn(
        "flex items-center justify-center rounded-lg border border-[#5E6654]/40 font-semibold text-[#5E6654] transition-colors hover:bg-[#20231A]/5 active:scale-[0.98] disabled:opacity-60",
        className,
      )}
    >
      {label}
    </button>
  );

  if (ignored) {
    return (
      <article className={cn("relative rounded-sm px-4 py-3.5 opacity-70 shadow-[0_4px_10px_rgba(32,35,26,0.12)]", bg, rotation)}>
        <Pin />
        <p className="text-[13.5px] leading-snug font-bold text-[#20231A]">{trend.title}</p>
        <button
          type="button"
          onClick={() => onSetState(trend.id, "new")}
          disabled={pending}
          className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#5E6654]/40 font-semibold text-[12px] text-[#5E6654] transition-colors hover:bg-[#20231A]/5 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Put it back up
        </button>
      </article>
    );
  }

  if (expanded) {
    return (
      <article
        {...toggleProps}
        className={cn(
          "relative col-span-2 animate-in cursor-pointer rounded-sm border border-[#9A5B00]/15 px-4 pt-5 pb-4 2xl:col-span-3 shadow-[0_10px_24px_rgba(32,35,26,0.22)] duration-300 fade-in focus-visible:ring-2 focus-visible:ring-[#34451F] focus-visible:outline-none sm:px-5.5 sm:pt-5.5",
          bg,
          "rotate-[-0.6deg]",
        )}
      >
        <Pin />

        <div className="flex items-start gap-3 sm:gap-3.5">
          <p className="text-[30px] leading-none sm:text-[40px]" aria-hidden="true">
            {emoji}
          </p>
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-[1.2] font-extrabold tracking-[-0.01em] text-[#20231A] sm:text-[21px]">
              {trend.title}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <EffortChips trend={trend} size="open" />
              <span className="rounded-full bg-[#20231A]/8 px-3 py-1 font-semibold text-[12px] text-[#20231A]">
                {KIND_CHIP[trend.kind]}
              </span>
            </div>
          </div>
        </div>

        {trend.relevance && (
          <div className="mt-3.5 rounded-[10px] border border-[#9A5B00]/25 bg-white/55 px-3.5 py-3">
            <p className="mb-1 font-bold text-[11px] tracking-[0.04em] text-[#9A5B00] uppercase sm:text-[12px]">
              Why your bar
            </p>
            <p className="text-[12.5px] leading-[1.55] text-[#20231A] sm:text-[13.5px]">{trend.relevance}</p>
          </div>
        )}

        {steps.length > 0 && (
          <div className="mt-2.5 rounded-[10px] border border-[#34451F]/25 bg-white/55 px-3.5 py-3">
            <p className="mb-2 font-bold text-[11px] tracking-[0.04em] text-[#34451F] uppercase sm:text-[12px]">
              How to do it
            </p>
            <div className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <p key={i} className="flex gap-2.5 text-[12.5px] leading-normal text-[#20231A] sm:text-[13.5px]">
                  <b className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-[#34451F] font-bold text-[11px] text-white sm:text-[12px]">
                    {i + 1}
                  </b>
                  <span>{step}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {keepButton("h-10 px-5 text-[13px]")}
          {binButton("Bin it", "h-10 px-3.5 text-[13px]")}
          {trend.source_url && (
            <a
              href={trend.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="ml-auto min-w-0 truncate font-semibold text-[12px] text-[#34451F] hover:underline"
            >
              🔗 Source: {trend.source_name || "view"}
            </a>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      {...toggleProps}
      title={onToggleExpanded ? "Tap the note for the full idea" : undefined}
      className={cn(
        "relative rounded-sm px-3.5 pt-4 pb-3 shadow-[0_6px_14px_rgba(32,35,26,0.16)] transition-shadow focus-visible:ring-2 focus-visible:ring-[#34451F] focus-visible:outline-none sm:px-4.5 sm:pt-5 sm:pb-4",
        bg,
        rotation,
        onToggleExpanded && "cursor-pointer hover:shadow-[0_10px_20px_rgba(32,35,26,0.22)]",
      )}
    >
      <Pin />
      <p className="text-[26px] leading-none sm:text-[34px]" aria-hidden="true">
        {emoji}
      </p>
      <h3 className="mt-2 mb-1 text-[13.5px] leading-tight font-extrabold tracking-[-0.01em] text-[#20231A] sm:mt-2.5 sm:mb-1.5 sm:text-[16.5px]">
        {trend.title}
      </h3>
      {trend.summary && (
        <p className="mb-2.5 hidden text-[13px] leading-normal text-[#5E6654] sm:block">{trend.summary}</p>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        <EffortChips trend={trend} size="note" />
      </div>

      <div className="flex items-center gap-2">
        {keepButton("h-9 flex-1 text-[12.5px]")}
        {binButton("Bin", "h-9 px-2.5 text-[12px]")}
      </div>
    </article>
  );
}
