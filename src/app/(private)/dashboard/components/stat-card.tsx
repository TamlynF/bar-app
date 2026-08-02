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
    <div className="items-center rounded-2xl border border-admin-line bg-admin-card p-3 text-center shadow-sm sm:p-4">
      <p className="text-[12px] leading-snug font-medium text-admin-muted sm:mb-2">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl leading-tight font-bold tracking-tight tabular-nums sm:text-3xl",
          positive ? "text-admin-success" : warn ? "text-admin-warning" : "text-admin-ink"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[12px] font-normal text-admin-muted sm:mt-1.5">
          {sub}
        </p>
      )}
      {delta && delta.pct !== null && (
        <p
          className={cn(
            "mt-1 text-[12px] font-semibold tabular-nums",
            delta.direction === "up"
              ? "text-admin-success"
              : delta.direction === "down"
                ? "text-admin-error"
                : "text-admin-muted"
          )}
        >
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "-"}{" "}
          {Math.abs(delta.pct)}% vs last month
        </p>
      )}
    </div>
  );
}