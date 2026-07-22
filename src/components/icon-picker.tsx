"use client";

import { cn } from "@/lib/utils";
import { BOOKING_CARD_ICONS, BOOKING_CARD_ICON_NAMES } from "@/lib/booking-card-icons";

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
    <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
      <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase opacity-60">{label}</span>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
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
                "flex aspect-square items-center justify-center rounded-xl border transition-all duration-200 active:scale-95",
                selected
                  ? "scale-105 border-[#5C4033] bg-[#5C4033] text-white shadow-md ring-2 ring-[#5C4033]/20"
                  : "border-[#E6DFC8] bg-white text-[#5F624F] hover:border-[#5C4033]/30 hover:bg-[#F7F4EA]"
              )}
            >
              <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
