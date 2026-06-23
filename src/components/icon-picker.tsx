"use client";

import { cn } from "@/lib/utils";
import { BOOKING_CARD_ICONS, BOOKING_CARD_ICON_NAMES } from "@/lib/booking-card-icons";

/**
 * Admin-themed grid for picking a Lucide icon name. Shares the icon set with the
 * public booking-card render via `BOOKING_CARD_ICONS`. Clicking the selected
 * icon again clears the selection.
 */
export function IconPicker({
  value,
  onChange,
  label = "Icon",
}: {
  value: string | null;
  onChange: (name: string | null) => void;
  label?: string;
}) {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{label}</span>
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
        {BOOKING_CARD_ICON_NAMES.map((name) => {
          const Icon = BOOKING_CARD_ICONS[name];
          const selected = value === name;
          return (
            <button
              key={name}
              title={name}
              type="button"
              aria-label={name}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : name)}
              className={cn(
                "flex items-center justify-center aspect-square rounded-xl border transition-all duration-200 active:scale-95",
                selected
                  ? "bg-[#5C4033] text-white border-[#5C4033] shadow-md ring-2 ring-[#5C4033]/20 scale-105"
                  : "hover:bg-[#F7F4EA] bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/30"
              )}
            >
              <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
