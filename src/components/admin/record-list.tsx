"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";

export function RecordList({
  variant = "panel",
  title,
  count,
  countLabel,
  badge,
  subtitle,
  actions,
  onAdd,
  addLabel = "Create",
  collapsible = true,
  toolbar,
  filters,
  activeFilterCount = 0,
  detail,
  children,
}: {
  variant?: "panel" | "cards";
  title?: string;
  count?: number;
  countLabel?: React.ReactNode;
  // A status pill for the group itself, beside the title and its count.
  badge?: React.ReactNode;
  // A second line under the title - a note about the group, not a record.
  subtitle?: React.ReactNode;
  // Group-level controls, left of the add button. They stop their own clicks so
  // the title beside them still collapses the group.
  actions?: React.ReactNode;
  // Left off for a list nothing can be added to, which hides the add button.
  onAdd?: () => void;
  addLabel?: string;
  collapsible?: boolean;
  toolbar?: React.ReactNode;
  // Filter pills, tucked behind a Filters button next to the search box.
  filters?: React.ReactNode;
  activeFilterCount?: number;
  // Detail panel shown beside the rows from xl up, below the toolbar.
  detail?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(activeFilterCount > 0);

  if (variant === "cards") {
    return (
      <div
        className={cn(
          "space-y-2.5",
          detail && "xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-2.5",
        )}
      >
        {!toolbar && !filters && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
              {countLabel}
            </p>
            {onAdd && (
              <Button
                onClick={onAdd}
                size="sm"
                className="h-11 rounded-xl bg-admin-primary px-4 text-[13px] font-semibold text-white hover:bg-admin-primary-hover sm:h-9"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {addLabel}
              </Button>
            )}
          </div>
        )}

        {(toolbar || filters) && (
          <div className="rounded-2xl border border-admin-line bg-admin-card/60 p-2.5 shadow-sm xl:shrink-0 sm:p-3">
            <div className="flex items-center gap-2">
              {toolbar && <div className="min-w-0 flex-1">{toolbar}</div>}
              {filters && (
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  aria-pressed={showFilters}
                  aria-expanded={showFilters}
                  title={showFilters ? "Hide filters" : "Show filters"}
                  className={cn(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition-colors sm:w-auto sm:px-4",
                    showFilters || activeFilterCount > 0
                      ? "border-admin-primary/30 bg-admin-primary-soft text-admin-primary"
                      : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:bg-admin-surface hover:text-admin-ink",
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-admin-primary px-1.5 text-[11px] font-semibold text-white tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}

              {onAdd && (
                <Button
                  onClick={onAdd}
                  size="sm"
                  title={addLabel}
                  className="h-11 shrink-0 rounded-xl bg-admin-primary px-3 text-[13px] font-semibold text-white hover:bg-admin-primary-hover sm:h-9 sm:px-4"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 sm:mr-1.5" />
                  <span className="hidden sm:inline">{addLabel}</span>
                </Button>
              )}
            </div>

            {filters && showFilters && (
              <div className="mt-2.5 border-t border-admin-line pt-2.5">{filters}</div>
            )}
          </div>
        )}

        {detail ? (
          <div className="xl:grid xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] xl:items-stretch xl:gap-5">
            <div className="xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1 xl:pb-1">
              {children}
            </div>
            {detail}
          </div>
        ) : (
          children
        )}
      </div>
    );
  }

  return (
    <section className="mx-auto w-full overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      {/* A toolbar fills the gap the title leaves on a wide table. It drops to
          its own line on phones, where there is no gap to fill. */}
      <div className="flex flex-wrap items-center gap-2 bg-admin-surface px-4 py-3 sm:flex-nowrap sm:px-5">
        <button
          type="button"
          onClick={() => collapsible && setCollapsed((c) => !c)}
          className={cn(
            "order-1 min-w-0 text-left",
            toolbar ? "flex-1 sm:flex-none" : "flex-1",
          )}
        >
          <span className="block truncate text-[11px] font-semibold tracking-wide text-admin-primary">
            {title}{" "}
            {count != null && <span className="text-admin-muted">({count})</span>}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-admin-muted">
              {subtitle}
            </span>
          )}
        </button>
        {toolbar && (
          <div className="order-3 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">{toolbar}</div>
        )}
        {/* Hard right with the row's controls, not beside the title - the group
            reads status-last the same way each of its rows does. */}
        {badge && <div className="order-2 mr-1 shrink-0 sm:order-3">{badge}</div>}
        {actions && (
          <div className="order-2 flex shrink-0 items-center gap-0.5 sm:order-3">{actions}</div>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={title ? `Add ${title}` : addLabel}
            className="order-2 flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-admin-primary text-white transition-colors hover:bg-admin-primary-hover sm:order-3 sm:h-8 sm:w-auto sm:px-3"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden text-[11px] font-semibold sm:inline">
              {addLabel}
            </span>
          </button>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="order-2 shrink-0 sm:order-4"
            title="Toggle group"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-admin-muted transition-transform duration-200",
                !collapsed && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      {(!collapsible || !collapsed) && (
        <div className="divide-y divide-admin-line/50">{children}</div>
      )}
    </section>
  );
}

export function ListRow({
  onClick,
  variant = "panel",
  selected = false,
  status,
  actions,
  className,
  children,
}: {
  onClick: () => void;
  variant?: "panel" | "card";
  selected?: boolean;
  // A status pill belongs in one place on every list: hard right, just inside
  // the chevron. Passing it here rather than as a child is what guarantees that.
  status?: React.ReactNode;
  // Per-row controls, outside the pill so the row still reads status-first.
  // They stop their own clicks; the rest of the row opens the record.
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-3 transition-all active:scale-[0.99]",
        variant === "card"
          ? "rounded-2xl border border-admin-line bg-admin-card px-4 py-2.5 hover:border-admin-primary/30 hover:shadow-sm"
          : "px-3 py-2.5 hover:bg-admin-surface/60 sm:px-4",
        selected &&
          (variant === "card"
            ? "border-admin-primary bg-admin-primary-soft/50 shadow-sm ring-1 ring-admin-primary/25"
            : "bg-admin-primary-soft/50"),
        className,
      )}
    >
      {children}
      {status && <div className="shrink-0">{status}</div>}
      {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
      <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted opacity-40" />
    </div>
  );
}

export function ListSearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl border border-admin-line bg-admin-card px-3 transition-colors focus-within:border-admin-primary/40">
      <Search className="h-4 w-4 shrink-0 text-admin-muted/50" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-admin-ink outline-none placeholder:text-admin-muted/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="shrink-0 text-admin-muted/60 hover:text-admin-primary"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FilterChip({
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
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10.5px] font-semibold tracking-wide transition-colors sm:h-9 sm:gap-1.5 sm:px-3 sm:text-[11px]",
        active
          ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
          : "border-admin-line bg-admin-card text-admin-muted hover:bg-admin-surface hover:text-admin-ink",
      )}
    >
      {children}
    </button>
  );
}

export function InfoBadge({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-admin-line bg-admin-surface px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-admin-muted",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  success: "border-admin-success/30 bg-admin-success-bg text-admin-success",
  error: "border-admin-error/30 bg-admin-error-bg text-admin-error",
  warning: "border-admin-warning/30 bg-admin-warning-bg text-admin-warning",
  info: "border-admin-info/30 bg-admin-info-bg text-admin-info",
  neutral: "border-admin-line bg-admin-surface text-admin-muted",
} as const;

export function StatusPill({
  tone,
  icon,
  children,
  className,
  showLabelOnMobile = false,
}: {
  tone: keyof typeof STATUS_TONES;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  // Set where there is room for the word - a sheet header rather than a list row.
  showLabelOnMobile?: boolean;
}) {
  // Success and error read from the icon and colour alone, so on a phone the
  // label steps aside for the row's own content. It stays in the accessibility
  // tree rather than being removed.
  const iconOnlyOnMobile =
    !showLabelOnMobile && !!icon && (tone === "success" || tone === "error");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold tracking-wide",
        STATUS_TONES[tone],
        className,
        iconOnlyOnMobile && "max-sm:min-w-0 max-sm:justify-center max-sm:px-1.5",
      )}
    >
      {icon}
      {iconOnlyOnMobile ? <span className="max-sm:sr-only">{children}</span> : children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-admin-line py-14 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-admin-muted opacity-30" />
      <p className="text-sm font-semibold text-admin-ink">{title}</p>
      {description && (
        <p className="mt-1 text-[11px] text-admin-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
