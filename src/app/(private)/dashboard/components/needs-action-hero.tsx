import Link from "next/link";
import { BellRing, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

export default function NeedsActionHero({ items, total }: { items: ActionItem[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-linear-to-b from-[#f0fdf4] to-[#FFFEFA] p-5 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600">
          <CheckCircle2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-black text-sm tracking-tight text-[#20231A] uppercase">All clear</p>
          <p className="mt-0.5 text-xs font-semibold text-[#5E6654]">Nothing needs action right now.</p>
        </div>
      </div>
    );
  }

  const active = items.filter((i) => i.count > 0);

  return (
    <div className="rounded-2xl border border-[#e9c9c0] bg-linear-to-b from-[#fff8f3] to-[#FFFEFA] p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600">
          <BellRing className="h-6 w-6 text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-black text-3xl leading-none text-[#20231A] tabular-nums">{total}</span>
          <span className="font-black text-[11px] leading-tight tracking-wide text-[#5E6654] uppercase">
            items need
            <br />
            action
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex h-3.5 overflow-hidden rounded-full bg-[#F4F1E8]">
        {active.map((i) => (
          <span
            key={i.key}
            className={cn("h-full w-(--w)", i.color)}
            style={{ "--w": `${(i.count / total) * 100}%` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-0.5">
        {active.map((i) => (
          <Link
            key={i.key}
            href={i.href}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#D8D5C8] bg-white px-3 transition-colors hover:border-[#d8cfb3] hover:bg-[#f3efe1]"
          >
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", i.color)} />
            <span className="text-xs font-bold whitespace-nowrap text-[#20231A]">{i.label}</span>
            <span className="font-black text-[13px] text-[#20231A] tabular-nums">{i.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
