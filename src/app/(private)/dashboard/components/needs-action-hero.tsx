"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

export default function NeedsActionHero({ items, total }: { items: ActionItem[]; total: number }) {
  const [open, setOpen] = useState(true);

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-linear-to-b from-[#f0fdf4] to-[#FFFEFA] p-5 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600">
          <CheckCircle2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-base leading-tight font-bold tracking-tight text-admin-ink">All clear</p>
          <p className="mt-0.5 text-sm font-normal text-admin-muted">Nothing needs action right now.</p>
        </div>
      </div>
    );
  }

  const active = items
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-2xl border border-[#e9c9c0] bg-linear-to-b from-[#fff8f3] to-[#FFFEFA] p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="needs-action-items"
        title={open ? "Hide items" : "Show items"}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600">
          <BellRing className="h-6 w-6 text-white" />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-3xl leading-none font-bold text-admin-ink tabular-nums">{total}</span>
          <span className="text-sm leading-snug font-medium text-admin-muted">
            items need action
          </span>
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-5 w-5 shrink-0 text-admin-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-[#F4F1E8]">
        {active.map((i) => (
          <span
            key={i.key}
            className={cn("h-full w-(--w)", i.color)}
            style={{ "--w": `${(i.count / total) * 100}%` } as React.CSSProperties}
          />
        ))}
      </div>

      <div
        id="needs-action-items"
        className={cn(
          "mt-3 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
          open ? "grid" : "hidden"
        )}
      >
        {active.map((i) => (
          <Link
            key={i.key}
            href={i.href}
            className="flex min-h-16 flex-col justify-center gap-1 rounded-xl border border-admin-line bg-admin-card px-3 py-2 transition-colors hover:border-[#d8cfb3] hover:bg-[#f3efe1]"
          >
            <span className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", i.color)} />
              <span className="text-lg leading-none font-bold text-admin-ink tabular-nums">
                {i.count}
              </span>
            </span>
            <span className="text-[11px] leading-tight font-medium text-admin-muted">
              {i.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
