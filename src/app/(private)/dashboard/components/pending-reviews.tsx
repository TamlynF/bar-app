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
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-black uppercase tracking-wide text-amber-800">
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
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-amber-200 hover:border-amber-400 transition-all group"
            >
              <Icon className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#1F1F1A] truncate">{item.name}</p>
                <p className="text-[10px] text-amber-700 uppercase tracking-wide font-bold">{typeLabel}</p>
              </div>
              <p className="text-[11px] text-[#5F624F] shrink-0 hidden sm:block">
                {new Date(item.created_at).toLocaleDateString("en-GB")}
              </p>
              <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href="/event-bookings/music-bookings?status=pending"
          className="flex-1 text-center text-[10px] font-black uppercase tracking-wide py-2 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
        >
          View Band Applications
        </Link>
        <Link
          href="/event-bookings/private-bookings?status=pending_review"
          className="flex-1 text-center text-[10px] font-black uppercase tracking-wide py-2 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
        >
          View Private Hire
        </Link>
      </div>
    </div>
  );
}
