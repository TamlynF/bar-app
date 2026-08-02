import React from "react";
import Link from "next/link";
import { Clock, Music, Building2, ArrowRight } from "lucide-react";

interface PendingItem {
  id: string;
  name: string;
  email: string;
  created_at: string;
  type: "band" | "private";
}

export function PendingReviews({ items }: { items: PendingItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600" />
        <h3 className="font-black text-sm tracking-wide text-amber-800 uppercase">
          Needs Review ({items.length})
        </h3>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const href = item.type === "band" ? "/event-bookings/music-bookings" : "/event-bookings/private-bookings";
          const Icon = item.type === "band" ? Music : Building2;
          const typeLabel = item.type === "band" ? "Band Application" : "Private Hire";

          return (
            <Link
              key={`${item.type}-${item.id}`}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 transition-all hover:border-amber-400"
            >
              <Icon className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm text-[#20231A]">{item.name}</p>
                <p className="text-[10px] font-bold tracking-wide text-amber-700 uppercase">{typeLabel}</p>
              </div>
              <p className="hidden shrink-0 text-[11px] text-[#5E6654] sm:block">
                {new Date(item.created_at).toLocaleDateString("en-GB")}
              </p>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-500 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href="/event-bookings/music-bookings?status=new"
          className="flex-1 rounded-xl bg-amber-100 py-2 text-center font-black text-[10px] tracking-wide text-amber-800 uppercase transition-colors hover:bg-amber-200"
        >
          View Band Applications
        </Link>
        <Link
          href="/event-bookings/private-bookings?status=pending"
          className="flex-1 rounded-xl bg-amber-100 py-2 text-center font-black text-[10px] tracking-wide text-amber-800 uppercase transition-colors hover:bg-amber-200"
        >
          View Private Hire
        </Link>
      </div>
    </div>
  );
}
