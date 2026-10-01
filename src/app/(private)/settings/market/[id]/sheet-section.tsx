"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* A titled part of the drink sheet that folds away, styled like the sections
   of the event sheet under Event setups. */
export function SheetSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-card max-sm:rounded-2xl max-sm:border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 bg-admin-line px-4 py-2 text-left transition-colors hover:brightness-95 sm:px-5",
          open && "border-b border-admin-line",
        )}
      >
        <span className="flex-1 text-[12px] font-bold text-admin-primary">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-admin-muted transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

/* A label and value line inside a SheetSection, on the type scale of the
   event setups view sheet. */
export function SheetRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center justify-between gap-4 border-b border-admin-line/70 px-4 py-2 last:border-0 sm:px-5",
        tone === "error" && "bg-admin-error-bg",
      )}
    >
      <span
        className={cn("shrink-0 text-[12px] font-semibold", tone === "error" ? "text-admin-error" : "text-admin-muted")}
      >
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-right text-[13px] font-semibold",
          tone === "error" ? "text-admin-error" : "text-admin-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
