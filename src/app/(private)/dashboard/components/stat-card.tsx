import React from "react";
import { cn } from "@/lib/utils";
import type { Delta } from "../lib/analytics";

export default function StatCard({
  label,
  value,
  sub,
  positive,
  warn,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  warn?: boolean;
  delta?: Delta;
}) {
  return (
    <div className="items-center rounded-2xl border border-[#E6DFC8] bg-white p-3 text-center shadow-sm sm:p-4">
      <p className="font-black text-[9px] leading-tight tracking-wide text-[#5F624F] uppercase sm:mb-3">
        {label}
      </p>
      <p
        className={cn(
          "font-black text-lg tracking-tighter tabular-nums sm:text-2xl",
          positive ? "text-green-600" : warn ? "text-amber-600" : "text-[#1F1F1A]"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[9px] font-bold tracking-wider text-[#5F624F] uppercase sm:mt-2">
          {sub}
        </p>
      )}
      {delta && delta.pct !== null && (
        <p
          className={cn(
            "mt-1 font-black text-[10px] tabular-nums",
            delta.direction === "up"
              ? "text-green-700"
              : delta.direction === "down"
                ? "text-red-600"
                : "text-[#5F624F]"
          )}
        >
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}{" "}
          {Math.abs(delta.pct)}% vs last month
        </p>
      )}
    </div>
  );
}