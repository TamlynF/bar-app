"use client";

import { cn } from "@/lib/utils";

function Track({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={cn(
        "relative h-6.5 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-admin-primary" : "bg-admin-line",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.75 left-0.75 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform",
          on && "translate-x-4.5",
        )}
      />
    </span>
  );
}

/* An on/off setting in a form, as a switch like the event sheet's, posting
   "on" under name when switched on. */
export function SwitchField({
  name,
  checked,
  onChange,
  label,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <>
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-11 flex-1 items-center justify-end disabled:cursor-not-allowed sm:min-h-9"
      >
        <Track on={checked} disabled={disabled} />
      </button>
    </>
  );
}

/* The same switch, read-only, for a value shown in view mode. */
export function SwitchDisplay({ on, label, disabled }: { on: boolean; label: string; disabled?: boolean }) {
  return (
    <span role="img" aria-label={`${label}: ${on ? "on" : "off"}`} className="inline-flex">
      <Track on={on} disabled={disabled} />
    </span>
  );
}
