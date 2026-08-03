"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronRight, Search, X } from "lucide-react";

export function RecordList({
  variant = "panel",
  title,
  count,
  countLabel,
  onAdd,
  addLabel = "Create",
  collapsible = true,
  toolbar,
  children,
}: {
  variant?: "panel" | "cards";
  title?: string;
  count?: number;
  countLabel?: React.ReactNode;
  onAdd: () => void;
  addLabel?: string;
  collapsible?: boolean;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (variant === "cards") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
            {countLabel}
          </p>
          <Button
            onClick={onAdd}
            size="sm"
            className="h-11 rounded-xl bg-admin-primary px-4 text-[13px] font-semibold text-white hover:bg-admin-primary-hover sm:h-9"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {addLabel}
          </Button>
        </div>
        {toolbar}
        {children}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      <div className="flex items-center gap-2 bg-admin-surface px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => collapsible && setCollapsed((c) => !c)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[11px] font-semibold tracking-wide text-admin-primary">
            {title}{" "}
            {count != null && <span className="text-admin-muted">({count})</span>}
          </p>
        </button>
        <button
          type="button"
          onClick={onAdd}
          title={title ? `Add ${title}` : addLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-admin-primary text-white transition-colors hover:bg-admin-primary-hover sm:h-8 sm:w-auto sm:px-3"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden text-[11px] font-semibold sm:inline">
            {addLabel}
          </span>
        </button>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0"
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
  className,
  children,
}: {
  onClick: () => void;
  variant?: "panel" | "card";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 transition-all active:scale-[0.99]",
        variant === "card"
          ? "rounded-2xl border border-admin-line bg-admin-card px-4 py-2.5 hover:border-admin-primary/30 hover:shadow-sm"
          : "px-3 py-2.5 hover:bg-admin-surface/60 sm:px-4",
        className,
      )}
    >
      {children}
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
        "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold tracking-wide transition-colors sm:h-9",
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
}: {
  tone: keyof typeof STATUS_TONES;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold tracking-wide",
        STATUS_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
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
