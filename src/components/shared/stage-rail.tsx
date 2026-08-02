"use client";

// src/components/shared/stage-rail.tsx
//
// The pipeline rail from the band booking sheet, extracted so both features
// share one implementation.
//
//   Interactive (band)  — pass onSelect. Stages become buttons that advance the
//                         record.
//   Read-only (quiz)    — omit onSelect. Stages render as spans, because quiz
//                         stages are derived from data. If they looked clickable
//                         the first thing anyone would try is clicking
//                         "Complete" to skip the work.
//
// The `escape` slot is the destructive terminal action (Decline / Clear drafts).
// It sits hard right, detached from the forward path, so it is never adjacent to
// the primary action.

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageRailItem<K extends string = string> {
  key: K;
  label: string;
}

export interface StageRailTheme {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

interface StageRailProps<K extends string = string> {
  stages: StageRailItem<K>[];
  current: K;
  themeFor: (key: K) => StageRailTheme;
  next?: K | null;
  onSelect?: (key: K) => void;
  isStageSelectable?: (key: K) => boolean;
  escape?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
  };
  className?: string;
}

export default function StageRail<K extends string = string>({
  stages,
  current,
  themeFor,
  next = null,
  onSelect,
  isStageSelectable,
  escape,
  className,
}: StageRailProps<K>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {stages.map((stage, i) => {
        const isCurrent = stage.key === current;
        const isNext = !isCurrent && stage.key === next;
        const theme = themeFor(stage.key);

        const selectable =
          typeof onSelect === "function" &&
          !isCurrent &&
          (isStageSelectable ? isStageSelectable(stage.key) : true);

        const base = cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-colors",
          isCurrent
            ? cn(theme.bg, theme.text, theme.border)
            : isNext
              ? "border-dashed border-admin-primary/40 bg-transparent text-admin-muted"
              : "border-admin-line bg-transparent text-admin-muted/60",
          selectable && "cursor-pointer hover:border-admin-primary hover:text-admin-primary"
        );

        const dot = (
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isCurrent ? theme.dot : "bg-admin-line"
            )}
          />
        );

        return (
          <React.Fragment key={stage.key}>
            {selectable ? (
              <button type="button" onClick={() => onSelect?.(stage.key)} className={base}>
                {dot}
                {stage.label}
              </button>
            ) : (
              <span className={base} aria-current={isCurrent ? "step" : undefined}>
                {dot}
                {stage.label}
              </span>
            )}

            {i < stages.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-admin-line" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}

      {escape && (
        <>
          <span className="min-w-2 flex-1" />
          <button
            type="button"
            onClick={escape.onClick}
            disabled={escape.disabled}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-colors",
              "border-red-200 text-red-600 hover:bg-red-50",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {escape.icon}
            {escape.label}
          </button>
        </>
      )}
    </div>
  );
}
