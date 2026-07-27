"use client";


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
              className={
                "inline-flex h-11 flex-none items-center gap-1.5 rounded-full px-4 font-black text-[11px] tracking-wide whitespace-nowrap uppercase transition-colors sm:h-9 " +
                (isActive
                  ? "bg-gold text-on-gold"
                  : "border border-hairline bg-canvas-2 text-ink-2 hover:bg-white/10 hover:text-ink")
              }
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
      </div>
    </div>
  );
}
