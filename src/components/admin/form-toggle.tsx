"use client";

import { cn } from "@/lib/utils";

export function FormToggle({
  on,
  onToggle,
  danger,
  label,
  disabled,
  title,
}: {
  on: boolean;
  onToggle: () => void;
  danger?: boolean;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        on
          ? danger
            ? "border-red-700 bg-red-600"
            : "border-green-600 bg-green-500"
          : "border-[#5E6654]/30 bg-[#5E6654]/20",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-5.25" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
