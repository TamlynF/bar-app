"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenueByType } from "../lib/analytics";

export function RevenueByTypeChart({
  data,
  bandSpend,
}: {
  data: RevenueByType[];
  bandSpend: number;
}) {
  return (
    <div className="rounded-2xl border border-[#D8D5C8] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-bold text-[12px] tracking-wide text-[#5E6654] uppercase">
          Revenue by type · this month
        </p>
        {bandSpend > 0 && (
          <p className="text-[12px] font-bold text-[#5E6654] tabular-nums">
            Band spend £{bandSpend.toFixed(0)}
          </p>
        )}
      </div>
      {data.length === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <p className="font-bold text-[12px] tracking-wide text-[#5E6654] uppercase opacity-40">
            No paid revenue yet
          </p>
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="type"
                width={80}
                tick={{ fontSize: 10, fill: "#5E6654", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #D8D5C8", fontSize: 12, fontWeight: 700 }}
                formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
                cursor={{ fill: "#F4F1E8" }}
              />
              <Bar dataKey="revenue" fill="#34451F" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}