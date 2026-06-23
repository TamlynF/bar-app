"use client";

/**
 * Filter chips for the /whats-on schedule. One horizontal-scroll row that
 * bleeds to the viewport edges (full-bleed) while the first chip stays aligned
 * with the centred content column. Controlled: the parent owns the active key
 * and the live per-subtype counts. Each chip = colour dot + label + count.
 */

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
}: {
  tabs: FilterTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    // Full-bleed: -mx-[50vw-50%] expands to the viewport edges. The track is
    // w-max + mx-auto so it centres when the chips fit, and still scrolls from
    // the start (no left clipping) when they overflow.
    <div className="-mx-[calc(50vw-50%)] overflow-x-auto no-scrollbar">
      <div className="flex w-max gap-2 mx-auto px-4 py-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              className={
                "flex-none whitespace-nowrap inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors " +
                (isActive
                  ? "bg-gold text-on-gold"
                  : "bg-canvas-2 text-ink-2 border border-hairline hover:text-ink hover:bg-white/10")
              }
            >
              {tab.color && (
                <span
                  className="ev-dot w-2 h-2 rounded-full shrink-0"
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
      </div>
    </div>
  );
}
