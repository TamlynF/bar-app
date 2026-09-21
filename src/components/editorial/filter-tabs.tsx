"use client";

import { cn } from "@/lib/utils";

/* One pill for every filter control on the public site: the category tabs,
   the sold-out switch and the filters toggle. `solid` is the selected tab;
   `active` is a toggled-on switch. */
export function filterChipClass(state: "idle" | "active" | "solid", className?: string) {
  return cn(
    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-btn font-semibold whitespace-nowrap transition-colors sm:h-9",
    state === "solid" && "border-gold bg-gold text-on-gold",
    state === "active" && "border-gold/40 bg-gold/15 text-gold",
    state === "idle" && "border-hairline bg-canvas-2 text-ink-2 hover:bg-white/10 hover:text-ink",
    className
  );
}


export type FilterTab = {
  key: string;
  label: string;
  color?: string | null;
  count?: number;
};

export function FilterTabs({
  tabs,
  active,
  onChange,
  trailing,
}: {
  tabs: FilterTab[];
  active: string;
  onChange: (key: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="flex w-max gap-2 py-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              className={filterChipClass(isActive ? "solid" : "idle", "flex-none")}
            >
              {tab.color && (
                <span
                  className="ev-dot h-2 w-2 shrink-0 rounded-full"
                  style={{ "--ev-c": tab.color } as React.CSSProperties}
                />
              )}
              {tab.label}
              {typeof tab.count === "number" && (
                <span
                  className={
                    "tabular-nums " +
                    (isActive ? "text-on-gold/70" : "text-ink-2/60")
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
        {trailing}
      </div>
    </div>
  );
}
