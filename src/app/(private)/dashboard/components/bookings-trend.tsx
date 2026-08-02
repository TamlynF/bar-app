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

type Range = "week" | "month" | "year";
type View = "summary" | "detail";

const W = 600;
const H = 120;
const PAD_TOP = 14;
const PAD_BOT = 18;
const DAY = 86_400_000;

const SERIES_COLORS = [
  "#5C4033", "#B45309", "#1B4332", "#2563EB",
  "#7C3AED", "#DB2777", "#0891B2", "#CA8A04",
  "#4B5563", "#9D174D",
];

const TOP_N = 5;
const OTHER_COLOR = "#9CA3AF";

const titleCase = (s: string) =>
  s ? s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : s;

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
  const [view, setView] = useState<View>("summary");
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

  const period = useMemo(() => {
    if (range === "week") {
      const dow = (new Date(nowMs).getUTCDay() + 6) % 7; // 0 = Monday
      const weekStart = utcDayStart(nowMs) - dow * DAY;
      const prevStart = weekStart - 7 * DAY;
      return {
        n: 7,
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        curLbl: "This week",
        prevLbl: "Last week",
        curBucket: (ms: number) => { const i = Math.round((utcDayStart(ms) - weekStart) / DAY); return i >= 0 && i < 7 ? i : -1; },
        prevBucket: (ms: number) => { const i = Math.round((utcDayStart(ms) - prevStart) / DAY); return i >= 0 && i < 7 ? i : -1; },
      };
    }
    if (range === "month") {
      const now = new Date(nowMs);
      const curY = now.getUTCFullYear();
      const curM = now.getUTCMonth();
      const prevRef = new Date(Date.UTC(curY, curM - 1, 1));
      const prevY = prevRef.getUTCFullYear();
      const prevM = prevRef.getUTCMonth();
      return {
        n: 5,
        labels: ["W1", "W2", "W3", "W4", "W5"],
        curLbl: "This month",
        prevLbl: "Last month",
        curBucket: (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() === curY && d.getUTCMonth() === curM ? Math.min(4, Math.floor((d.getUTCDate() - 1) / 7)) : -1; },
        prevBucket: (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() === prevY && d.getUTCMonth() === prevM ? Math.min(4, Math.floor((d.getUTCDate() - 1) / 7)) : -1; },
      };
    }
    const curY = new Date(nowMs).getUTCFullYear();
    const prevY = curY - 1;
    return {
      n: 12,
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      curLbl: "This year",
      prevLbl: "Last year",
      curBucket: (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() === curY ? d.getUTCMonth() : -1; },
      prevBucket: (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() === prevY ? d.getUTCMonth() : -1; },
    };
  }, [range, nowMs]);

  const summary = useMemo(() => {
    const inFilter = (b: TrendBooking) => {
      if (applied === "all") return true;
      if (applied.startsWith("type:")) return b.typeId === applied.slice(5);
      if (applied.startsWith("sub:")) return b.subId === applied.slice(4);
      return true;
    };
    const cur = new Array(period.n).fill(0);
    const prev = new Array(period.n).fill(0);
    for (const b of bookings) {
      if (!inFilter(b)) continue;
      const ms = new Date(b.createdAt).getTime();
      const ic = period.curBucket(ms); if (ic >= 0) cur[ic]++;
      const ip = period.prevBucket(ms); if (ip >= 0) prev[ip]++;
    }
    return { cur, prev };
  }, [bookings, applied, period]);

  const detail = useMemo(() => {
    let groups: { id: string; name: string }[] = [];
    let keyOf: (b: TrendBooking) => string | null = () => null;

    if (applied === "all") {
      groups = taxonomy.map((t) => ({ id: t.id, name: t.name }));
      keyOf = (b) => b.typeId;
    } else if (applied.startsWith("type:")) {
      const tid = applied.slice(5);
      const t = taxonomy.find((t) => t.id === tid);
      groups = t ? t.subs.map((s) => ({ id: s.id, name: s.name })) : [];
      keyOf = (b) => (b.typeId === tid ? b.subId : null);
    } else if (applied.startsWith("sub:")) {
      const sid = applied.slice(4);
      let name = sid;
      for (const t of taxonomy) { const s = t.subs.find((s) => s.id === sid); if (s) { name = s.name; break; } }
      groups = [{ id: sid, name }];
      keyOf = (b) => (b.subId === sid ? sid : null);
    }

    const idx = new Map(groups.map((g, i) => [g.id, i]));
    const cur = groups.map(() => new Array(period.n).fill(0));
    const prev = groups.map(() => new Array(period.n).fill(0));
    for (const b of bookings) {
      const key = keyOf(b);
      if (key == null) continue;
      const gi = idx.get(key);
      if (gi === undefined) continue;
      const ms = new Date(b.createdAt).getTime();
      const ci = period.curBucket(ms); if (ci >= 0) cur[gi][ci]++;
      const pi = period.prevBucket(ms); if (pi >= 0) prev[gi][pi]++;
    }

    let list = groups.map((g, i) => ({
      id: g.id,
      name: g.name,
      vals: cur[i],
      prevVals: prev[i],
      total: cur[i].reduce((a, b) => a + b, 0),
    }));

    list.sort((a, b) => b.total - a.total);
    if (list.length > TOP_N) {
      const keep = list.slice(0, TOP_N);
      const rest = list.slice(TOP_N);
      const oVals = new Array(period.n).fill(0);
      const oPrev = new Array(period.n).fill(0);
      let oTotal = 0;
      for (const s of rest) {
        for (let i = 0; i < period.n; i++) { oVals[i] += s.vals[i]; oPrev[i] += s.prevVals[i]; }
        oTotal += s.total;
      }
      keep.push({ id: "__other__", name: `Other (${rest.length})`, vals: oVals, prevVals: oPrev, total: oTotal });
      list = keep;
    }

    return list.map((s, i) => ({
      ...s,
      color: s.id === "__other__" ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length],
    }));
  }, [bookings, applied, taxonomy, period]);

  const isDetail = view === "detail";

  const rawMax = isDetail
    ? Math.max(1, ...detail.flatMap((s) => [...s.vals, ...s.prevVals]))
    : Math.max(1, ...summary.cur, ...summary.prev);
  const niceMax = Math.max(2, Math.ceil((rawMax * 1.1) / 2) * 2);
  const ticks = [niceMax, niceMax / 2, 0];

  const curPath = linePath(summary.cur, niceMax, false);
  const prevPath = linePath(summary.prev, niceMax, false);
  const areaPath = linePath(summary.cur, niceMax, true);

  const sumCur = summary.cur.reduce((a, b) => a + b, 0);
  const sumPrev = summary.prev.reduce((a, b) => a + b, 0);
  const up = sumCur >= sumPrev;
  const delta =
    sumPrev === 0 ? (sumCur > 0 ? "New" : "0%") : `${up ? "+" : ""}${Math.round(((sumCur - sumPrev) / sumPrev) * 100)}%`;

  const labelFor = (v: string) => {
    if (v === "all") return "All bookable events";
    if (v.startsWith("type:")) {
      const t = taxonomy.find((t) => t.id === v.slice(5));
      return t ? `${titleCase(t.name)} - all` : "All bookable events";
    }
    if (v.startsWith("sub:")) {
      for (const t of taxonomy) {
        const s = t.subs.find((s) => s.id === v.slice(4));
        if (s) return `${titleCase(t.name)} · ${titleCase(s.name)}`;
      }
    }
    return "All bookable events";
  };

  const selectedType = selType ? taxonomy.find((t) => t.id === selType) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="h-4 w-4 text-[#5F624F]" />
        <h2 className="font-black text-[11px] tracking-wide text-[#5F624F] uppercase">Bookings</h2>
        <div className="ml-auto flex gap-1 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] p-1 shadow-sm">
          {(["week", "month", "year"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-black text-[10px] tracking-wide uppercase transition-colors",
                range === r ? "bg-[#5C4033] text-white shadow-sm" : "text-[#5F624F] hover:bg-white",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E6DFC8] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-[#5F624F]" />
          <div ref={ref} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border bg-[#F7F4EA] px-3 py-2 text-[11px] font-bold text-[#1F1F1A] transition-colors",
                open ? "border-[#5C4033] ring-2 ring-[#5C4033]/15" : "border-[#E6DFC8] hover:border-[#d3cbb0]",
              )}
            >
              <span className="flex-1 truncate text-left">{labelFor(applied)}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[#5F624F] transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-40 overflow-hidden rounded-xl border border-[#E6DFC8] bg-white shadow-[0_18px_40px_-12px_rgba(31,31,26,0.30)]">
                <div className="grid grid-cols-2">
                  <div className="max-h-60 overflow-y-auto border-r border-[#E6DFC8] p-1.5">
                    <p className="px-2 pt-1.5 pb-1 font-black text-[8px] tracking-[0.09em] text-[#a7a288] uppercase">Event type</p>
                    <FilterOpt
                      label="All bookable events"
                      active={applied === "all"}
                      onClick={() => { setApplied("all"); setSelType(null); setOpen(false); }}
                    />
                    {taxonomy.map((t) => (
                      <FilterOpt
                        key={t.id}
                        label={titleCase(t.name)}
                        chevron={t.subs.length > 0}
                        selected={selType === t.id}
                        active={applied === `type:${t.id}` && selType === t.id}
                        onClick={() => { setSelType(t.id); setApplied(`type:${t.id}`); }}
                      />
                    ))}
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1.5">
                    {!selectedType ? (
                      <p className="p-3 text-[10px] leading-relaxed font-medium text-[#a7a288] italic">
                        Pick an event type to filter by its sub-types.
                      </p>
                    ) : (
                      <>
                        <p className="px-2 pt-1.5 pb-1 font-black text-[8px] tracking-[0.09em] text-[#a7a288] uppercase">{titleCase(selectedType.name)} sub-type</p>
                        <FilterOpt
                          label={`All ${titleCase(selectedType.name)}`}
                          active={applied === `type:${selectedType.id}`}
                          onClick={() => { setApplied(`type:${selectedType.id}`); setOpen(false); }}
                        />
                        {selectedType.subs.map((s) => (
                          <FilterOpt
                            key={s.id}
                            label={titleCase(s.name)}
                            active={applied === `sub:${s.id}`}
                            onClick={() => { setApplied(`sub:${s.id}`); setOpen(false); }}
                          />
                        ))}
                        {selectedType.subs.length === 0 && (
                          <p className="p-3 text-[10px] font-medium text-[#a7a288] italic">No sub-types with bookings.</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-lg border border-[#E6DFC8] bg-[#F7F4EA] p-0.5">
            {(["summary", "detail"] as View[]).map((vw) => (
              <button
                key={vw}
                type="button"
                onClick={() => setView(vw)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-black text-[9px] tracking-wide uppercase transition-colors",
                  view === vw ? "bg-[#5C4033] text-white shadow-sm" : "text-[#5F624F] hover:bg-white",
                )}
              >
                {vw}
              </button>
            ))}
          </div>
        </div>

        {isDetail ? (
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
            {detail.length === 0 ? (
              <span className="text-[9px] font-bold tracking-wide text-[#a7a288] uppercase">No breakdown for this selection</span>
            ) : (
              <>
                {detail.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 font-black text-[9px] tracking-wide text-[#5F624F] uppercase">
                    <i
                      className="h-0 w-3.5 rounded-sm border-t-[2.5px] border-(--c)"
                      style={{ "--c": s.color } as React.CSSProperties}
                    /> {titleCase(s.name)}
                  </span>
                ))}
                <span className="basis-full text-[8px] font-bold tracking-wide text-[#a7a288] uppercase">
                  Solid = {period.curLbl} · dashed = {period.prevLbl}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="mb-2.5 flex items-center gap-4 px-0.5">
            <span className="flex items-center gap-1.5 font-black text-[9px] tracking-wide text-[#5F624F] uppercase">
              <i className="h-0 w-3.5 rounded-sm border-t-[2.5px] border-[#5C4033]" /> {period.curLbl}
            </span>
            <span className="flex items-center gap-1.5 font-black text-[9px] tracking-wide text-[#5F624F] uppercase">
              <i className="h-0 w-3.5 rounded-sm border-t-[2.5px] border-dashed border-[#bdb49a]" /> {period.prevLbl}
            </span>
            <span className={cn("ml-auto font-black text-[9px] tracking-wide uppercase", up ? "text-green-700" : "text-red-600")}>
              {delta}
            </span>
          </div>
        )}

        <div className="relative pl-7">
          <div className="absolute top-0 bottom-6 left-0 w-6">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-(--t) right-0 -translate-y-1/2 font-black text-[8.5px] text-[#a7a288] tabular-nums"
                style={{ "--t": `${(yFor(t, niceMax) / H) * 100}%` } as React.CSSProperties}
              >
                {t}
              </span>
            ))}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("w-full", isDetail ? "h-44 sm:h-52" : "h-28 sm:h-32")}>
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
            {isDetail ? (
              <>
                {detail.map((s) => {
                  const p = linePath(s.prevVals, niceMax, false);
                  return (
                    <path
                      key={`prev-${s.id}`}
                      d={p.d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="1.5"
                      strokeDasharray="3 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {detail.map((s) => {
                  const c = linePath(s.vals, niceMax, false);
                  return (
                    <g key={s.id}>
                      <path d={c.d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={c.last[0]} cy={c.last[1]} r="3.5" fill={s.color} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                <path d={areaPath.d} fill="url(#trend-area)" />
                <path d={prevPath.d} fill="none" stroke="#bdb49a" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <path d={curPath.d} fill="none" stroke="#5C4033" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <circle cx={curPath.last[0]} cy={curPath.last[1]} r="4" fill="#5C4033" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>

          <div className="mt-1.5 flex justify-between px-0.5">
            {period.labels.map((l) => (
              <span key={l} className="text-[9px] font-bold tracking-wide text-[#5F624F] uppercase">
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
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-colors",
        active ? "bg-[#5C4033] text-white" : selected ? "bg-[#efe9d8] text-[#5C4033]" : "text-[#1F1F1A] hover:bg-[#F7F4EA]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {chevron && <ChevronDown className="h-3 w-3 shrink-0 -rotate-90 opacity-60" />}
    </button>
  );
}
