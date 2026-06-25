"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendBooking {
  createdAt: string;
  typeId: string;
  typeName: string;
  subId: string | null;
  subName: string | null;
}

type Range = "week" | "month";

// SVG canvas (stretched to fill width via preserveAspectRatio="none"; strokes
// stay crisp with vector-effect="non-scaling-stroke").
const W = 600;
const H = 120;
const PAD_TOP = 14;
const PAD_BOT = 18;
const DAY = 86_400_000;

const yFor = (v: number, max: number) => H - PAD_BOT - (v / max) * (H - PAD_TOP - PAD_BOT);
const xFor = (i: number, n: number) => (n === 1 ? 0 : (i / (n - 1)) * W);
const utcDayStart = (ms: number) => Math.floor(ms / DAY) * DAY;

function linePath(vals: number[], max: number, close: boolean) {
  const n = vals.length;
  const pts = vals.map((v, i) => [Math.round(xFor(i, n)), Math.round(yFor(v, max))] as const);
  let d = "M" + pts.map((p) => `${p[0]},${p[1]}`).join(" L");
  if (close) d += ` L${W},${H} L0,${H} Z`;
  return { d, last: pts[pts.length - 1] };
}

export default function BookingsTrend({ bookings, nowMs }: { bookings: TrendBooking[]; nowMs: number }) {
  const [range, setRange] = useState<Range>("week");
  const [applied, setApplied] = useState<string>("all"); // 'all' | 'type:<id>' | 'sub:<id>'
  const [selType, setSelType] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Distinct types (and their sub-types) present in the data — the filterable set.
  const taxonomy = useMemo(() => {
    const types = new Map<string, { id: string; name: string; subs: Map<string, { id: string; name: string }> }>();
    for (const b of bookings) {
      if (!types.has(b.typeId)) types.set(b.typeId, { id: b.typeId, name: b.typeName, subs: new Map() });
      const t = types.get(b.typeId)!;
      if (b.subId && !t.subs.has(b.subId)) t.subs.set(b.subId, { id: b.subId, name: b.subName ?? b.subId });
    }
    return Array.from(types.values())
      .map((t) => ({ id: t.id, name: t.name, subs: Array.from(t.subs.values()).sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings]);

  // Bucket counts for the current + previous period. All date math is in UTC and
  // keyed off the server-passed `nowMs`, so SSR and client agree (no mismatch).
  const series = useMemo(() => {
    const inFilter = (b: TrendBooking) => {
      if (applied === "all") return true;
      if (applied.startsWith("type:")) return b.typeId === applied.slice(5);
      if (applied.startsWith("sub:")) return b.subId === applied.slice(4);
      return true;
    };
    const rows = bookings.filter(inFilter);

    if (range === "week") {
      const dow = (new Date(nowMs).getUTCDay() + 6) % 7; // 0 = Monday
      const weekStart = utcDayStart(nowMs) - dow * DAY;
      const prevStart = weekStart - 7 * DAY;
      const cur = new Array(7).fill(0);
      const prev = new Array(7).fill(0);
      for (const b of rows) {
        const ms = utcDayStart(new Date(b.createdAt).getTime());
        const ic = Math.round((ms - weekStart) / DAY);
        if (ic >= 0 && ic < 7) cur[ic]++;
        const ip = Math.round((ms - prevStart) / DAY);
        if (ip >= 0 && ip < 7) prev[ip]++;
      }
      return { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], cur, prev, curLbl: "This week", prevLbl: "Last week" };
    }

    const now = new Date(nowMs);
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    const prevRef = new Date(Date.UTC(curY, curM - 1, 1));
    const prevY = prevRef.getUTCFullYear();
    const prevM = prevRef.getUTCMonth();
    const cur = new Array(5).fill(0);
    const prev = new Array(5).fill(0);
    for (const b of rows) {
      const d = new Date(b.createdAt);
      const w = Math.min(4, Math.floor((d.getUTCDate() - 1) / 7));
      if (d.getUTCFullYear() === curY && d.getUTCMonth() === curM) cur[w]++;
      else if (d.getUTCFullYear() === prevY && d.getUTCMonth() === prevM) prev[w]++;
    }
    return { labels: ["W1", "W2", "W3", "W4", "W5"], cur, prev, curLbl: "This month", prevLbl: "Last month" };
  }, [bookings, range, applied, nowMs]);

  const sumCur = series.cur.reduce((a, b) => a + b, 0);
  const sumPrev = series.prev.reduce((a, b) => a + b, 0);
  const up = sumCur >= sumPrev;
  const delta =
    sumPrev === 0 ? (sumCur > 0 ? "New" : "0%") : `${up ? "+" : ""}${Math.round(((sumCur - sumPrev) / sumPrev) * 100)}%`;

  const rawMax = Math.max(1, ...series.cur, ...series.prev);
  const niceMax = Math.max(2, Math.ceil((rawMax * 1.1) / 2) * 2);
  const ticks = [niceMax, niceMax / 2, 0];

  const cur = linePath(series.cur, niceMax, false);
  const prev = linePath(series.prev, niceMax, false);
  const area = linePath(series.cur, niceMax, true);

  const labelFor = (v: string) => {
    if (v === "all") return "All bookable events";
    if (v.startsWith("type:")) {
      const t = taxonomy.find((t) => t.id === v.slice(5));
      return t ? `${t.name} — all` : "All bookable events";
    }
    if (v.startsWith("sub:")) {
      for (const t of taxonomy) {
        const s = t.subs.find((s) => s.id === v.slice(4));
        if (s) return `${t.name} · ${s.name}`;
      }
    }
    return "All bookable events";
  };

  const selectedType = selType ? taxonomy.find((t) => t.id === selType) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="w-4 h-4 text-[#5F624F]" />
        <h2 className="text-[11px] font-black uppercase tracking-wide text-[#5F624F]">Bookings</h2>
        <div className="ml-auto flex gap-0.5 p-0.5 rounded-lg bg-[#F7F4EA] border border-[#E6DFC8]">
          {(["week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-colors",
                range === r ? "bg-white text-[#5C4033] shadow-sm" : "text-[#5F624F]",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-4 shadow-sm">
        {/* Event filter */}
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-[#5F624F] shrink-0" />
          <div ref={ref} className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "w-full flex items-center gap-2 text-[11px] font-bold text-[#1F1F1A] bg-[#F7F4EA] border rounded-lg px-3 py-2 transition-colors",
                open ? "border-[#5C4033] ring-2 ring-[#5C4033]/15" : "border-[#E6DFC8] hover:border-[#d3cbb0]",
              )}
            >
              <span className="flex-1 text-left truncate">{labelFor(applied)}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-[#5F624F] shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute z-40 top-[calc(100%+6px)] left-0 right-0 bg-white border border-[#E6DFC8] rounded-xl shadow-[0_18px_40px_-12px_rgba(31,31,26,0.30)] overflow-hidden">
                <div className="grid grid-cols-2">
                  {/* Column 1 — event types */}
                  <div className="max-h-60 overflow-y-auto p-1.5 border-r border-[#E6DFC8]">
                    <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#a7a288] px-2 pt-1.5 pb-1">Event type</p>
                    <FilterOpt
                      label="All bookable events"
                      active={applied === "all"}
                      onClick={() => { setApplied("all"); setSelType(null); setOpen(false); }}
                    />
                    {taxonomy.map((t) => (
                      <FilterOpt
                        key={t.id}
                        label={t.name}
                        chevron={t.subs.length > 0}
                        selected={selType === t.id}
                        active={applied === `type:${t.id}` && selType === t.id}
                        onClick={() => { setSelType(t.id); setApplied(`type:${t.id}`); }}
                      />
                    ))}
                  </div>
                  {/* Column 2 — sub-types of the selected type */}
                  <div className="max-h-60 overflow-y-auto p-1.5">
                    {!selectedType ? (
                      <p className="text-[10px] font-medium text-[#a7a288] italic p-3 leading-relaxed">
                        Pick an event type to filter by its sub-types.
                      </p>
                    ) : (
                      <>
                        <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#a7a288] px-2 pt-1.5 pb-1">{selectedType.name} sub-type</p>
                        <FilterOpt
                          label={`All ${selectedType.name}`}
                          active={applied === `type:${selectedType.id}`}
                          onClick={() => { setApplied(`type:${selectedType.id}`); setOpen(false); }}
                        />
                        {selectedType.subs.map((s) => (
                          <FilterOpt
                            key={s.id}
                            label={s.name}
                            active={applied === `sub:${s.id}`}
                            onClick={() => { setApplied(`sub:${s.id}`); setOpen(false); }}
                          />
                        ))}
                        {selectedType.subs.length === 0 && (
                          <p className="text-[10px] font-medium text-[#a7a288] italic p-3">No sub-types with bookings.</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-2.5 px-0.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-[#5F624F]">
            <i className="w-3.5 h-0 border-t-[2.5px] border-[#5C4033] rounded-sm" /> {series.curLbl}
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-[#5F624F]">
            <i className="w-3.5 h-0 border-t-[2.5px] border-dashed border-[#bdb49a] rounded-sm" /> {series.prevLbl}
          </span>
          <span className={cn("ml-auto text-[9px] font-black uppercase tracking-wide", up ? "text-green-700" : "text-red-600")}>
            {delta}
          </span>
        </div>

        {/* Plot */}
        <div className="relative pl-7">
          {/* y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-6">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 text-[8.5px] font-black tabular-nums text-[#a7a288] top-(--t)"
                style={{ "--t": `${(yFor(t, niceMax) / H) * 100}%` } as React.CSSProperties}
              >
                {t}
              </span>
            ))}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-28 sm:h-32">
            <defs>
              <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5C403322" />
                <stop offset="1" stopColor="#5C403300" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                x2={W}
                y1={yFor(t, niceMax)}
                y2={yFor(t, niceMax)}
                stroke="#E6DFC8"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area.d} fill="url(#trend-area)" />
            <path d={prev.d} fill="none" stroke="#bdb49a" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={cur.d} fill="none" stroke="#5C4033" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={cur.last[0]} cy={cur.last[1]} r="4" fill="#5C4033" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* x-axis labels */}
          <div className="flex justify-between mt-1.5 px-0.5">
            {series.labels.map((l) => (
              <span key={l} className="text-[9px] font-bold uppercase tracking-wide text-[#5F624F]">
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterOpt({
  label,
  active,
  selected,
  chevron,
  onClick,
}: {
  label: string;
  active?: boolean;
  selected?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold text-left transition-colors",
        active ? "bg-[#5C4033] text-white" : selected ? "bg-[#efe9d8] text-[#5C4033]" : "text-[#1F1F1A] hover:bg-[#F7F4EA]",
      )}
    >
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {chevron && <ChevronDown className="w-3 h-3 shrink-0 -rotate-90 opacity-60" />}
    </button>
  );
}
