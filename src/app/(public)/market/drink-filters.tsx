"use client";

import { useState } from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MarketInstrumentPayload } from "@/lib/market/tick";

export type DrinkFilters = {
  query: string;
  hideSoldOut: boolean;
  dealsOnly: boolean;
  watchedOnly: boolean;
};

/* Sold-out drinks stay off the list unless someone asks for them. */
export const DEFAULT_FILTERS: DrinkFilters = { query: "", hideSoldOut: true, dealsOnly: false, watchedOnly: false };
export const EMPTY_FILTERS: DrinkFilters = { ...DEFAULT_FILTERS, hideSoldOut: false };

type QuickKey = "hideSoldOut" | "dealsOnly" | "watchedOnly";

const QUICK: { key: QuickKey; label: string }[] = [
  { key: "hideSoldOut", label: "Hide sold out" },
  { key: "dealsOnly", label: "Deals only" },
  { key: "watchedOnly", label: "Watching" },
];

/* Quick filters that differ from the defaults - what the badge counts and
   what Clear puts back. */
export function activeFilterCount(filters: DrinkFilters): number {
  return QUICK.filter(({ key }) => filters[key] !== DEFAULT_FILTERS[key]).length;
}

export function isFiltered(filters: DrinkFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.query.trim() !== "";
}

export function applyDrinkFilters(
  instruments: MarketInstrumentPayload[],
  filters: DrinkFilters,
  watched: number[]
): MarketInstrumentPayload[] {
  const needle = filters.query.trim().toLowerCase();
  return instruments.filter((instrument) => {
    if (filters.hideSoldOut && instrument.stock === "out") return false;
    if (filters.dealsOnly && !(instrument.tierPct < 0 || instrument.changePct < 0)) return false;
    if (filters.watchedOnly && !watched.includes(instrument.id)) return false;
    if (!needle) return true;
    const haystack = [instrument.name, instrument.serve, instrument.category ?? ""].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

/* Search plus a row of one-tap filters, tucked behind a Filters button so
   the phone keeps its first screen for the board. */
export function DrinkFilterBar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: DrinkFilters;
  onChange: (next: DrinkFilters) => void;
  shown: number;
  total: number;
}) {
  const [open, setOpen] = useState(activeFilterCount(filters) > 0);
  const active = activeFilterCount(filters);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Search drinks"
            aria-label="Search drinks"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 rounded-xl border-white/15 bg-[#242c12] pr-10 pl-9 text-body text-ink placeholder:text-stone-500 focus-visible:border-gold focus-visible:ring-gold/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, query: "" })}
              aria-label="Clear search"
              className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="drink-quick-filters"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-btn font-semibold transition-colors ${
            open || active > 0
              ? "border-gold bg-gold/10 text-gold"
              : "border-white/15 bg-[#242c12] text-ink hover:border-gold/60 hover:text-gold"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 text-gold" aria-hidden="true" />
          Filters
          {active > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-pill font-bold text-on-gold">
              {active}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div id="drink-quick-filters" className="flex flex-wrap items-center gap-2">
          {QUICK.map(({ key, label }) => {
            const on = filters[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...filters, [key]: !on })}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-btn font-semibold transition-colors ${
                  on
                    ? "border-gold bg-gold text-on-gold"
                    : "border-white/15 bg-[#242c12] text-stone-300 hover:border-gold/60 hover:text-gold"
                }`}
              >
                {on && <Check className="h-4 w-4" aria-hidden="true" />}
                {label}
              </button>
            );
          })}
          {isFiltered(filters) && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="ml-auto inline-flex min-h-11 items-center px-2 text-meta font-semibold text-stone-400 transition-colors hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {(isFiltered(filters) || shown !== total) && (
        <p className="text-meta text-stone-500">
          Showing {shown} of {total} drinks
        </p>
      )}
    </div>
  );
}
