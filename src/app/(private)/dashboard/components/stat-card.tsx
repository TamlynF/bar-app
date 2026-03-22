import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: string;
  urgent?: boolean;
}

export function StatCard({ label, value, icon: Icon, accent = "#26300D", urgent }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-5 flex items-center gap-4",
        urgent ? "border-amber-300 bg-amber-50/50" : "border-[#E6DFC8]"
      )}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-2xl font-black text-[#1F1F1A]">{value}</p>
        <p className={cn("text-[10px] font-black uppercase tracking-widest", urgent ? "text-amber-700" : "text-[#5F624F]")}>
          {label}
        </p>
      </div>
    </div>
  );
}
