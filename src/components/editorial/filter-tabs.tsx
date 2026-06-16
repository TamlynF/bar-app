"use client";

/**
 * Sticky filter/tab bar (awwwards-style category sub-nav). Controlled: the
 * parent owns the active key and is notified on change. Horizontally
 * scrollable on mobile. Optional per-tab colour dot (used for event subtypes).
 */

export type FilterTab = { key: string; label: string; color?: string | null };

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
    <div className="sticky top-14 sm:top-16 z-30 -mx-4 px-4 py-3 bg-[#1a2008]/85 backdrop-blur-xl border-b border-white/10">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              className={
                "shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors " +
                (isActive
                  ? "bg-[#FDCC4B] text-[#1a2008]"
                  : "bg-white/5 text-stone-400 border border-white/10 hover:text-white hover:bg-white/10")
              }
            >
              {tab.color && (
                <span
                  className="ev-dot w-2 h-2 rounded-full shrink-0"
                  style={{ "--ev-c": tab.color } as React.CSSProperties}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
