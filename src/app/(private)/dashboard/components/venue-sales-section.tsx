// dashboard/components/venue-sales-section.tsx
"use client";

import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import StatCard from "./stat-card";
import type { VenueSalesData } from "../lib/venue-sales";

const CATEGORY_COLORS: Record<string, string> = {
  Drinks: "#5C4033",
  Food: "#B45309",
  Tickets: "#1B4332",
  Other: "#8A8266",
};

export function VenueSalesSection({ data }: { data: VenueSalesData }) {
  if (!data.connected) {
    return (
      <div className="bg-white p-8 border border-[#E6DFC8] rounded-2xl text-center">
        <p className="font-black text-[#1F1F1A] text-sm">No Square sales yet</p>
        <p className="mt-1 font-medium text-[#5F624F] text-[11px] leading-relaxed">
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
      {/* Headline stats */}
      <div className="gap-3 grid grid-cols-2 sm:grid-cols-4">
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

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        {/* Daily takings trend */}
        <div className="bg-white shadow-sm p-4 sm:p-5 border border-[#E6DFC8] rounded-2xl">
          <p className="mb-3 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
            Takings · last 30 days
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="venue-takings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1B4332" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1B4332" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#5F624F" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#5F624F" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `£${v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E6DFC8", fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Takings"]}
                />
                <Area type="monotone" dataKey="takings" stroke="#1B4332" strokeWidth={2} fill="url(#venue-takings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category split */}
        <div className="bg-white shadow-sm p-4 sm:p-5 border border-[#E6DFC8] rounded-2xl">
          <p className="mb-3 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
            Sales by category · this month
          </p>
          {categories.length === 0 ? (
            <div className="flex justify-center items-center h-44">
              <p className="opacity-40 font-black text-[#5F624F] text-[9px] uppercase tracking-wide">
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
                    tick={{ fontSize: 10, fill: "#5F624F", fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E6DFC8", fontSize: 12, fontWeight: 700 }}
                    formatter={(value) => [`£${Number(value ?? 0).toFixed(2)}`, "Takings"]}
                    cursor={{ fill: "#F7F4EA" }}
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

      {/* Takings per event night */}
      {byEvent.length > 0 && (
        <div className="bg-white shadow-sm p-4 sm:p-5 border border-[#E6DFC8] rounded-2xl">
          <p className="mb-3 font-black text-[#5F624F] text-[10px] uppercase tracking-wide">
            Takings by event night · this month
          </p>
          <ul className="divide-y divide-[#E6DFC8]">
            {byEvent.map((e) => (
              <li key={`${e.date}-${e.title}`} className="flex justify-between items-center gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-black text-[#1F1F1A] text-xs truncate">{e.title}</p>
                  <p className="font-bold text-[#5F624F] text-[10px] uppercase tracking-wide">
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black tabular-nums text-[#1B4332] text-sm">£{e.takings.toFixed(2)}</p>
                  {e.tips > 0 && (
                    <p className="font-bold tabular-nums text-[#5F624F] text-[10px]">£{e.tips.toFixed(2)} tips</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.lastSyncedAt && (
        <p className="text-right font-bold text-[#8A8266] text-[9px] uppercase tracking-wide">
          Synced {formatDistanceToNow(new Date(data.lastSyncedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
