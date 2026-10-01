"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatGbp } from "@/lib/price";

export type ModifierOption = { name: string; price: number | null };

function optionPrice(price: number | null): string {
  return price != null && price > 0 ? `+${formatGbp(price)}` : "No charge";
}

/* A Square modifier list as a pill that opens to show its options and what
   each adds to the price. */
export default function ModifierListPopover({
  name,
  options,
  label,
  suffix,
}: {
  name: string;
  options: ModifierOption[];
  label: string;
  suffix?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex min-h-11 items-center rounded-lg border border-admin-line bg-admin-surface px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-admin-muted transition-colors hover:border-admin-primary hover:text-admin-primary focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:min-h-7"
        >
          {name}
          {suffix}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-2xl border-admin-line bg-admin-card p-0">
        <p className="border-b border-admin-line px-4 py-2.5 text-[13px] font-bold text-admin-ink">
          {name}
          <span className="block text-[11px] font-medium text-admin-muted">
            {options.length} {options.length === 1 ? "option" : "options"} in Square
          </span>
        </p>
        {options.length === 0 ? (
          <p className="px-4 py-3 text-[12px] text-admin-muted">This list has no options.</p>
        ) : (
          <ul className="m-0 max-h-72 list-none divide-y divide-admin-line/60 overflow-y-auto p-0">
            {options.map((option) => (
              <li key={option.name} className="flex items-center justify-between gap-3 px-4 py-1.5 text-[12px]">
                <span className="min-w-0 truncate text-admin-ink">{option.name}</span>
                <span className="shrink-0 text-admin-muted tabular-nums">{optionPrice(option.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
