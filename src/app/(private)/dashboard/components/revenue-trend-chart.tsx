"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueTrendChart({ data }: { data: { week: string; revenue: number; bookings: number }[] }) {
  return (
    <div className="rounded-2xl border border-[#D8D5C8] bg-white p-4 shadow-sm sm:p-5">
      <p className="mb-3 font-bold text-[12px] tracking-wide text-[#5E6654] uppercase">
        Revenue · last 12 weeks
      </p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34451F" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34451F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#5E6654" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#5E6654" }} tickLine={false} axisLine={false}
              tickFormatter={(v) => `£${v}`} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #D8D5C8", fontSize: 12, fontWeight: 700 }}
              formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="#34451F" strokeWidth={2} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}