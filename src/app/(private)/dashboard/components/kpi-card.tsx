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
  collectedDeltaPct: number;
  unpaidCount: number;
  confirmedDelta: number;
  newGuestsDelta: number;
}) {
  const total = collected + outstanding;
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

  return (
    <div className="rounded-2xl border border-[#D8D5C8] bg-white p-3.5 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-black text-[9px] tracking-wide text-[#5E6654] uppercase">{monthLabel} collection rate</span>
        <span className={cn("font-black text-[11px] tabular-nums", outstanding > 0 ? "text-amber-700" : "text-green-700")}>
          {pct}%{outstanding > 0 ? ` · £${outstanding.toFixed(0)} due` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-[#D8D5C8] bg-[#F4F1E8]">
        <span
          className="block h-full w-(--w) rounded-full bg-green-600"
          style={{ "--w": pct > 0 ? `${pct}%` : "0.5rem" } as React.CSSProperties}
        />
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[#D8D5C8]">
        <Cell label="Collected" value={`£${collected.toFixed(0)}`} valueClass="text-green-700" trend={{ value: `${collectedDeltaPct}%`, up: collectedDeltaPct >= 0 }} />
        <Cell label="Outstanding" value={`£${outstanding.toFixed(0)}`} valueClass="text-amber-700" sub={`${unpaidCount} unpaid`} />
        <Cell label="Confirmed" value={String(confirmed)} valueClass="text-[#20231A]" trend={{ value: signed(confirmedDelta), up: confirmedDelta >= 0 }} />
        <Cell label="New Guests" value={String(newGuests)} valueClass="text-[#20231A]" trend={{ value: signed(newGuestsDelta), up: newGuestsDelta >= 0 }} />
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
      <div className="font-black text-[9px] tracking-wide text-[#5E6654] uppercase">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-black text-xl leading-none tabular-nums", valueClass)}>{value}</span>
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 font-black text-[9px]", trend.up ? "text-green-700" : "text-red-600")}>
            {trend.up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            {trend.value}
          </span>
        )}
        {sub && <span className="text-[9px] font-bold tracking-wide text-[#5E6654] uppercase">{sub}</span>}
      </div>
    </div>
  );
}
