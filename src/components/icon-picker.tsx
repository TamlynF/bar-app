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
    <div className="space-y-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
      <span className="block font-black text-[10px] tracking-wide text-[#5E6654] uppercase">{label}</span>
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
                  ? "scale-105 border-[#34451F] bg-[#34451F] text-white shadow-md ring-2 ring-[#34451F]/20"
                  : "border-[#D8D5C8] bg-white text-[#5E6654] hover:border-[#34451F]/30 hover:bg-[#F4F1E8]"
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
