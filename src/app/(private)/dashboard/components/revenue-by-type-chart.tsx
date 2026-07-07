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
    <div className="bg-white shadow-sm p-4 sm:p-5 border border-[#E6DFC8] rounded-2xl">
      <div className="flex justify-between items-baseline mb-3">
        <p className="font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
          Revenue by type · this month
        </p>
        {bandSpend > 0 && (
          <p className="font-bold tabular-nums text-[#5F624F] text-[10px]">
            Band spend £{bandSpend.toFixed(0)}
          </p>
        )}
      </div>
      {data.length === 0 ? (
        <div className="flex justify-center items-center h-44">
          <p className="opacity-40 font-black text-[#5F624F] text-[9px] uppercase tracking-wide">
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
                tick={{ fontSize: 10, fill: "#5F624F", fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E6DFC8", fontSize: 12, fontWeight: 700 }}
                formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
                cursor={{ fill: "#F7F4EA" }}
              />
              <Bar dataKey="revenue" fill="#5C4033" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}