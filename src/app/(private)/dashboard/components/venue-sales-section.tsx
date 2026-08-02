"use client";

import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import StatCard from "./stat-card";
import type { VenueSalesData } from "../lib/venue-sales";

const CATEGORY_COLORS: Record<string, string> = {
  Drinks: "#34451F",
  Food: "#9A5B00",
  Tickets: "#34451F",
  Other: "#8A8266",
};

export function VenueSalesSection({ data }: { data: VenueSalesData }) {
  if (!data.connected) {
    return (
      <div className="rounded-2xl border border-[#D8D5C8] bg-white p-8 text-center">
        <p className="font-black text-sm text-[#20231A]">No Square sales yet</p>
        <p className="mt-1 text-[11px] leading-relaxed font-medium text-[#5E6654]">
          Takings appear here once the hourly Square sync has run against live
          sales data. Bar, food and POS sales are shown separately from
          pre-booked booking revenue.
        </p>
      </div>
    );
  }

  const { thisMonth, deltas, categories, daily, byEvent } = data;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Takings"
          value={`£${thisMonth.takings.toFixed(2)}`}
          sub="bar · food · POS"
          positive
          delta={deltas.takings}
        />
        <StatCard
          label="Tips"
          value={`£${thisMonth.tips.toFixed(2)}`}
          sub="this month"
          delta={deltas.tips}
        />
        <StatCard
          label="Card Fees"
          value={`£${thisMonth.fees.toFixed(2)}`}
          sub="Square fees"
          warn={thisMonth.fees > 0}
        />
        <StatCard
          label="Refunds"
          value={`£${thisMonth.refunds.toFixed(2)}`}
          sub="this month"
          warn={thisMonth.refunds > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#D8D5C8] bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
            Takings · last 30 days
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="venue-takings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34451F" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#34451F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#5E6654" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#5E6654" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `£${v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #D8D5C8", fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Takings"]}
                />
                <Area type="monotone" dataKey="takings" stroke="#34451F" strokeWidth={2} fill="url(#venue-takings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D8D5C8] bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
            Sales by category · this month
          </p>
          {categories.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <p className="font-black text-[9px] tracking-wide text-[#5E6654] uppercase opacity-40">
                No categorised sales yet
              </p>
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={70}
                    tick={{ fontSize: 10, fill: "#5E6654", fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #D8D5C8", fontSize: 12, fontWeight: 700 }}
                    formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Takings"]}
                    cursor={{ fill: "#F4F1E8" }}
                  />
                  <Bar dataKey="revenue" radius={[0, 8, 8, 0]} barSize={18}>
                    {categories.map((c) => (
                      <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? "#8A8266"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {byEvent.length > 0 && (
        <div className="rounded-2xl border border-[#D8D5C8] bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
            Takings by event night · this month
          </p>
          <ul className="divide-y divide-[#D8D5C8]">
            {byEvent.map((e) => (
              <li key={`${e.date}-${e.title}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-black text-xs text-[#20231A]">{e.title}</p>
                  <p className="text-[10px] font-bold tracking-wide text-[#5E6654] uppercase">
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-sm text-[#34451F] tabular-nums">£{e.takings.toFixed(2)}</p>
                  {e.tips > 0 && (
                    <p className="text-[10px] font-bold text-[#5E6654] tabular-nums">£{e.tips.toFixed(2)} tips</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.lastSyncedAt && (
        <p className="text-right text-[9px] font-bold tracking-wide text-[#8A8266] uppercase">
          Synced {formatDistanceToNow(new Date(data.lastSyncedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
