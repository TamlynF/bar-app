"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORY_TOGGLE =
  "flex min-h-11 w-full items-center gap-2 border-y border-admin-primary/15 bg-admin-primary-soft text-left text-[11px] font-semibold tracking-wide text-admin-primary uppercase transition-colors hover:bg-admin-primary-soft/70 sm:min-h-9";

export const CATEGORY_TOGGLE_NOTE = "font-medium tracking-normal text-admin-primary/75 normal-case";

/* One headline number on a Square links header that also filters the list
   to what it counts. Phones pick the same filters from a popup instead. */
export function StatTile({
  label,
  value,
  note,
  active,
  onClick,
  tone,
  progress,
}: {
  label: string;
  value: number;
  note: string;
  active: boolean;
  onClick: () => void;
  tone?: "warning";
  progress?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={note}
      className={cn(
        "relative flex min-h-12 items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none",
        active
          ? "border-admin-primary/40 bg-admin-primary-soft"
          : "border-admin-line bg-admin-card hover:border-admin-primary/30 hover:bg-admin-surface",
      )}
    >
      <span className="text-[12px] font-semibold text-admin-muted">{label}</span>
      <span
        className={cn(
          "text-[18px] leading-none font-bold tabular-nums",
          tone === "warning" ? "text-admin-warning" : "text-admin-ink",
        )}
      >
        {value.toLocaleString("en-GB")}
      </span>
      {progress != null && (
        <span
          className="absolute inset-x-0 bottom-0 h-1 bg-admin-line"
          style={{ "--fill": `${Math.min(100, Math.max(0, progress))}%` } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="block h-full w-(--fill) bg-admin-success" />
        </span>
      )}
    </button>
  );
}

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors",
        active
          ? "border-admin-primary/40 bg-admin-primary-soft text-admin-primary"
          : "border-admin-line bg-admin-card text-admin-muted",
      )}
    >
      {children}
    </button>
  );
}

/* A row of joined segments where exactly one is on - the desktop twin of a
   pill list in the phone filter popup. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("h-9 items-center overflow-hidden rounded-xl border border-admin-line bg-admin-card p-0.5 shadow-xs", className)}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "h-full rounded-lg px-3 text-[12px] font-semibold whitespace-nowrap transition-colors",
              active ? "bg-admin-primary-soft text-admin-primary" : "text-admin-muted hover:bg-admin-surface hover:text-admin-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* The phone-only button beside search that opens the filter popup, with a
   dot while any filter is on. */
export function FiltersButton({
  filtered,
  label,
  onClick,
}: {
  filtered: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors sm:hidden",
        filtered
          ? "border-admin-primary/40 bg-admin-primary-soft text-admin-primary"
          : "border-admin-line bg-admin-card text-admin-muted",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      {filtered && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-admin-primary" aria-hidden="true" />
      )}
    </button>
  );
}

export const HEADER_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-xl border border-admin-line bg-admin-card px-3.5 text-[13px] font-semibold whitespace-nowrap text-admin-ink shadow-xs transition-colors hover:border-admin-primary/30 hover:bg-admin-primary-soft hover:text-admin-primary focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 [&_svg]:text-admin-primary";

export const HEADER_PRIMARY_BUTTON =
  "flex h-11 items-center justify-center gap-1.5 rounded-xl bg-admin-primary px-3.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-xs transition-colors hover:bg-admin-primary-hover focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9";
