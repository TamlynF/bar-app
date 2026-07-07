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
    <div className="items-center bg-white shadow-sm p-3 sm:p-4 border border-[#E6DFC8] rounded-2xl text-center">
      <p className="sm:mb-3 font-black text-[#5F624F] text-[9px] uppercase leading-tight tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "font-black tabular-nums text-lg sm:text-2xl tracking-tighter",
          positive ? "text-green-600" : warn ? "text-amber-600" : "text-[#1F1F1A]"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 sm:mt-2 font-bold text-[#5F624F] text-[9px] uppercase tracking-wider">
          {sub}
        </p>
      )}
      {delta && delta.pct !== null && (
        <p
          className={cn(
            "mt-1 font-black tabular-nums text-[10px]",
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