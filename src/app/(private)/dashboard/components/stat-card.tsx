import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  sub,
  positive,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl p-3 sm:p-4 shadow-sm items-center text-center">
      <p className="text-[9px] font-black uppercase tracking-wide text-[#5F624F] sm:mb-3 leading-tight">
        {label}
      </p>
      <p
        className={cn(
          "text-lg sm:text-2xl font-black tabular-nums tracking-tighter",
          positive ? "text-green-600" : warn ? "text-amber-600" : "text-[#1F1F1A]"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] font-bold text-[#5F624F] uppercase tracking-wider mt-1 sm:mt-2">
          {sub}
        </p>
      )}
    </div>
  );
}