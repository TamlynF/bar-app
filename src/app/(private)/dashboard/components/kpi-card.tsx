import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KpiCard({
  monthLabel,
  collected,
  outstanding,
  confirmed,
  newGuests,
  collectedDeltaPct,
  unpaidCount,
  confirmedDelta,
  newGuestsDelta,
}: {
  monthLabel: string;
  collected: number;
  outstanding: number;
  confirmed: number;
  newGuests: number;
  /** Month-over-month % change in collected revenue. */
  collectedDeltaPct: number;
  /** Count of unpaid bookings making up the outstanding total. */
  unpaidCount: number;
  /** Change in confirmed bookings vs last month. */
  confirmedDelta: number;
  /** Change in new guests vs last month. */
  newGuestsDelta: number;
}) {
  const total = collected + outstanding;
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl p-3.5 shadow-sm">
      {/* Collection rate */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-wide text-[#5F624F]">{monthLabel} collection rate</span>
        <span className={cn("text-[11px] font-black tabular-nums", outstanding > 0 ? "text-amber-700" : "text-green-700")}>
          {pct}%{outstanding > 0 ? ` · £${outstanding.toFixed(0)} due` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#F7F4EA] border border-[#E6DFC8] overflow-hidden">
        <span
          className="block h-full bg-green-600 rounded-full w-(--w)"
          style={{ "--w": pct > 0 ? `${pct}%` : "0.5rem" } as React.CSSProperties}
        />
      </div>

      {/* 2×2 stat grid */}
      <div className="grid grid-cols-2 gap-px mt-3.5 bg-[#E6DFC8] rounded-xl overflow-hidden">
        <Cell label="Collected" value={`£${collected.toFixed(0)}`} valueClass="text-green-700" trend={{ value: `${collectedDeltaPct}%`, up: collectedDeltaPct >= 0 }} />
        <Cell label="Outstanding" value={`£${outstanding.toFixed(0)}`} valueClass="text-amber-700" sub={`${unpaidCount} unpaid`} />
        <Cell label="Confirmed" value={String(confirmed)} valueClass="text-[#1F1F1A]" trend={{ value: signed(confirmedDelta), up: confirmedDelta >= 0 }} />
        <Cell label="New Guests" value={String(newGuests)} valueClass="text-[#1F1F1A]" trend={{ value: signed(newGuestsDelta), up: newGuestsDelta >= 0 }} />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  valueClass,
  trend,
  sub,
}: {
  label: string;
  value: string;
  valueClass: string;
  trend?: { value: string; up: boolean };
  sub?: string;
}) {
  return (
    <div className="bg-white px-3 py-2.5">
      <div className="text-[9px] font-black uppercase tracking-wide text-[#5F624F]">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className={cn("text-xl font-black tabular-nums leading-none", valueClass)}>{value}</span>
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-black", trend.up ? "text-green-700" : "text-red-600")}>
            {trend.up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
            {trend.value}
          </span>
        )}
        {sub && <span className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F]">{sub}</span>}
      </div>
    </div>
  );
}
