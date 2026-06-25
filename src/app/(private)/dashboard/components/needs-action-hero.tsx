import Link from "next/link";
import { BellRing, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  /** Tailwind background class for the segment + legend dot. */
  color: string;
}

export default function NeedsActionHero({ items, total }: { items: ActionItem[]; total: number }) {
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-[#bbf7d0] bg-linear-to-b from-[#f0fdf4] to-[#FFFDF7] p-5 flex items-center gap-3 shadow-sm">
        <div className="w-11 h-11 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-tight text-[#1F1F1A]">All clear</p>
          <p className="text-xs font-semibold text-[#5F624F] mt-0.5">Nothing needs action right now.</p>
        </div>
      </div>
    );
  }

  const active = items.filter((i) => i.count > 0);

  return (
    <div className="rounded-2xl border border-[#e9c9c0] bg-linear-to-b from-[#fff8f3] to-[#FFFDF7] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
          <BellRing className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums text-[#1F1F1A] leading-none">{total}</span>
          <span className="text-[11px] font-black uppercase tracking-wide text-[#5F624F] leading-tight">
            items need
            <br />
            action
          </span>
        </div>
      </div>

      {/* Segmented breakdown bar */}
      <div className="flex h-3.5 mt-3.5 rounded-full overflow-hidden bg-[#F7F4EA]">
        {active.map((i) => (
          <span
            key={i.key}
            className={cn("h-full w-(--w)", i.color)}
            style={{ "--w": `${(i.count / total) * 100}%` } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Legend chips */}
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5">
        {active.map((i) => (
          <Link
            key={i.key}
            href={i.href}
            className="shrink-0 inline-flex items-center gap-2 min-h-10 px-3 rounded-full bg-white border border-[#E6DFC8] hover:border-[#d8cfb3] hover:bg-[#f3efe1] transition-colors"
          >
            <span className={cn("w-2.5 h-2.5 rounded-[3px] shrink-0", i.color)} />
            <span className="text-xs font-bold text-[#1F1F1A] whitespace-nowrap">{i.label}</span>
            <span className="text-[13px] font-black tabular-nums text-[#1F1F1A]">{i.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
