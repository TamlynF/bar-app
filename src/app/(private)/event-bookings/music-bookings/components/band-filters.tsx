"use client";

import React from "react";
import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker, dateRangeLabel, type DateRange } from "@/app/(private)/event-setups/events/month-picker";
import { cn } from "@/lib/utils";

/**
 * Everything the board can be narrowed or ordered by, in one object — so the list
 * can hold a single piece of state and the panel can patch it, rather than a
 * dozen setters being threaded through.
 */
export type BandFilterState = {
  favOnly: boolean;
  /** Does the act cost anything? */
  fee: "any" | "free" | "paid";
  /** Has the booked slot been and gone? Undated requests match neither. */
  when: "any" | "past" | "upcoming";
  /** Lower-cased `type` values; empty = no type filter. */
  types: string[];
  /** Lower-cased `genre` values; empty = no genre filter. */
  genres: string[];
  /** Against `selected_date`. */
  slotRange: DateRange | null;
  /** Matches when ANY of the applicant's preferred dates lands in the range. */
  prefRange: DateRange | null;
  sortKey: "created" | "modified" | "preferred";
  sortAsc: boolean;
};

export const EMPTY_FILTERS: BandFilterState = {
  favOnly: false,
  fee: "any",
  when: "any",
  types: [],
  genres: [],
  slotRange: null,
  prefRange: null,
  sortKey: "created",
  sortAsc: false,
};

export const SORT_LABELS: Record<BandFilterState["sortKey"], string> = {
  created: "Created",
  modified: "Modified",
  preferred: "1st preferred date",
};

/** How many narrowing choices are on. Sort is an ordering, not a filter, so it doesn't count. */
export function countActiveFilters(f: BandFilterState): number {
  return (
    (f.favOnly ? 1 : 0) +
    (f.fee !== "any" ? 1 : 0) +
    (f.when !== "any" ? 1 : 0) +
    f.types.length +
    f.genres.length +
    (f.slotRange?.start ? 1 : 0) +
    (f.prefRange?.start ? 1 : 0)
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block font-black text-[9px] tracking-widest text-[#5C4033] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A pill that's either on or off. The panel is built almost entirely from these. */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 font-black text-[9px] tracking-wide uppercase transition-colors",
        on
          ? "border-[#5C4033] bg-[#5C4033] text-white"
          : "border-[#E6DFC8] bg-white text-[#5F624F] hover:bg-[#F7F4EA]"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The filter panel. Lives in a popover rather than expanding inline: the board
 * below is the point of the page, and nine dimensions of controls would push it
 * off-screen every time they opened.
 */
export default function BandFiltersPopover({
  value,
  onChange,
  typeOptions,
  genreOptions,
}: {
  value: BandFilterState;
  /** Patch — merged over the current state by the caller. */
  onChange: (patch: Partial<BandFilterState>) => void;
  /** Distinct lower-cased values present in the data, with display labels. */
  typeOptions: { key: string; label: string }[];
  genreOptions: { key: string; label: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const activeCount = countActiveFilters(value);

  const toggleIn = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          title={open ? "Hide filters" : "Show filters"}
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border font-black text-[11px] tracking-widest uppercase transition-colors sm:w-auto sm:px-4",
            // Idle sits as a light espresso tint — the same hue the pressed state
            // fills solid, so it reads as the un-clicked version of the same button.
            open || activeCount > 0
              ? "border-[#5C4033] bg-[#5C4033] text-white"
              : "border-[#5C4033]/20 bg-[#5C4033]/10 text-[#5C4033] hover:bg-[#5C4033]/20"
          )}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-black text-[9px] text-[#5C4033] tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        // The date pickers below are popovers of their own, portalled out of this
        // one — so a click on a day reads as "outside" and would otherwise close
        // the whole panel mid-pick. Anything landing in another popper is a click
        // on our own nested UI, not a dismissal.
        onPointerDownOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest?.("[data-radix-popper-content-wrapper]")) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest?.("[data-radix-popper-content-wrapper]")) e.preventDefault();
        }}
        className="max-h-112 w-80 space-y-3 overflow-y-auto rounded-2xl border-2 border-[#E6DFC8] bg-white p-4"
      >
        <Group label="Show">
          <div className="flex flex-wrap gap-1.5">
            <Chip on={value.favOnly} onClick={() => onChange({ favOnly: !value.favOnly })}>
              Favourites
            </Chip>
            {(["free", "paid"] as const).map((k) => (
              <Chip
                key={k}
                on={value.fee === k}
                onClick={() => onChange({ fee: value.fee === k ? "any" : k })}
              >
                {k}
              </Chip>
            ))}
            {(["past", "upcoming"] as const).map((k) => (
              <Chip
                key={k}
                on={value.when === k}
                onClick={() => onChange({ when: value.when === k ? "any" : k })}
              >
                {k}
              </Chip>
            ))}
          </div>
        </Group>

        {typeOptions.length > 0 && (
          <Group label="Type">
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((t) => (
                <Chip
                  key={t.key}
                  on={value.types.includes(t.key)}
                  onClick={() => onChange({ types: toggleIn(value.types, t.key) })}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </Group>
        )}

        {genreOptions.length > 0 && (
          <Group label="Genre">
            <div className="flex flex-wrap gap-1.5">
              {genreOptions.map((g) => (
                <Chip
                  key={g.key}
                  on={value.genres.includes(g.key)}
                  onClick={() => onChange({ genres: toggleIn(value.genres, g.key) })}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </Group>
        )}

        <Group label="Booked date">
          <DatePicker
            value={value.slotRange}
            onChange={(slotRange) => onChange({ slotRange })}
            className="w-full"
          />
        </Group>

        <Group label="Preferred dates">
          <DatePicker
            value={value.prefRange}
            onChange={(prefRange) => onChange({ prefRange })}
            className="w-full"
          />
          <p className="text-[10px] leading-snug text-[#5F624F]/70">
            Matches when any preferred date falls in the range.
          </p>
        </Group>

        <Group label="Sort by">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SORT_LABELS) as BandFilterState["sortKey"][]).map((k) => (
              <Chip key={k} on={value.sortKey === k} onClick={() => onChange({ sortKey: k })}>
                {SORT_LABELS[k]}
              </Chip>
            ))}
            <button
              type="button"
              onClick={() => onChange({ sortAsc: !value.sortAsc })}
              title="Reverse order"
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[#E6DFC8] bg-[#EFE8D4] px-2.5 font-black text-[9px] tracking-wide text-[#5C4033] uppercase transition-colors hover:brightness-95"
            >
              <ArrowDownUp className="h-3 w-3" />
              {value.sortAsc ? "Oldest first" : "Newest first"}
            </button>
          </div>
        </Group>
      </PopoverContent>
    </Popover>
  );
}

export { dateRangeLabel };
export type { DateRange };
