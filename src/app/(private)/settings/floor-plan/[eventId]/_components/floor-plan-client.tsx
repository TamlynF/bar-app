"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  AlertCircle,
  AlertTriangle,
  Eye,
  Armchair,
  Info,
  RotateCcw,
  RotateCw,
  Move,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  polygonBounds,
  round,
  clamp,
  snap,
  screenToWorld,
  facingToVector,
  doorClearancePolygon,
  benchSeatPositions,
} from "@/lib/floor-plan/geometry";
import {
  computeFloorPlan,
  focalPointsFrom,
  buildBlockers,
  MIN_AISLE,
  type CalcTable,
  type SightRating,
  type TableOverride,
} from "@/lib/floor-plan/calculator";
import type { Feature, Fixture, Obstacle, Point, RoomOutline } from "@/lib/floor-plan/types";
import { saveFloorPlanLayoutAction } from "../actions";

const RATING_FILL: Record<SightRating, string> = { good: "#16A34A", acceptable: "#D97706", poor: "#DC2626" };
const FIXTURE_FILL: Record<string, string> = {
  stage: "#4338CA",
  bar: "#5C4033",
  dj_booth: "#7C3AED",
  projector: "#0EA5E9",
  tv: "#0D9488",
};

type SavedLayout = {
  settings?: { chairZone?: number; aisleWidth?: number; mustSee?: string[] };
  tables?: Array<{ mappingId: number; extraChairs?: number; x?: number; y?: number; rotation?: number }>;
  savedAt?: string;
} | null;

export default function FloorPlanClient({
  event,
  room,
  obstacles,
  fixtures,
  features,
  tables,
  availableCount,
  savedLayout,
}: {
  event: { id: number; title: string; date: string };
  room: RoomOutline | null;
  obstacles: Obstacle[];
  fixtures: Fixture[];
  features: Feature[];
  tables: CalcTable[];
  availableCount: number;
  savedLayout: SavedLayout;
}) {
  const saved = savedLayout ?? null;

  // ── Inputs ──
  const [chairZone, setChairZone] = useState<number>(saved?.settings?.chairZone ?? 0.5);
  const [aisleWidth, setAisleWidth] = useState<number>(saved?.settings?.aisleWidth ?? MIN_AISLE);
  const [mustSee, setMustSee] = useState<string[]>(saved?.settings?.mustSee ?? []);
  const [tableChairs, setTableChairs] = useState<Record<number, number>>(() => {
    const savedChairs = new Map((saved?.tables ?? []).map((t) => [t.mappingId, t.extraChairs ?? 0]));
    return Object.fromEntries(tables.map((t) => [t.mappingId, savedChairs.get(t.mappingId) ?? t.extraChairs]));
  });
  const [overrides, setOverrides] = useState<Record<number, TableOverride>>(() => {
    const o: Record<number, TableOverride> = {};
    for (const t of saved?.tables ?? []) {
      if (typeof t.x === "number" && typeof t.y === "number") {
        o[t.mappingId] = { x: t.x, y: t.y, rotation: t.rotation ?? 0 };
      }
    }
    return o;
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ mappingId: number; grabDX: number; grabDY: number } | null>(null);

  const markDirty = () => setDirty(true);

  // ── Derived inputs ──
  const focals = useMemo(() => focalPointsFrom(fixtures), [fixtures]);
  const blockers = useMemo(() => buildBlockers(obstacles, fixtures, features), [obstacles, fixtures, features]);
  const benchSeats = useMemo(
    () => features.filter((f) => f.kind === "bench").reduce((s, f) => s + (f.seats ?? 0), 0),
    [features]
  );
  const tablesWithChairs = useMemo<CalcTable[]>(
    () => tables.map((t) => ({ ...t, extraChairs: tableChairs[t.mappingId] ?? t.extraChairs })),
    [tables, tableChairs]
  );

  const result = useMemo(
    () =>
      computeFloorPlan({
        room,
        blockers,
        focals,
        tables: tablesWithChairs,
        availableCount,
        benchSeats,
        settings: { chairZone, aisleWidth, mustSee },
        overrides,
      }),
    [room, blockers, focals, tablesWithChairs, availableCount, benchSeats, chairZone, aisleWidth, mustSee, overrides]
  );

  // ── Viewport (metres) — encompass room + all geometry ──
  const view = useMemo(() => {
    const pts: Point[] = [{ x: 0, y: 0 }];
    if (room) pts.push(...room.points, { x: room.width, y: room.length });
    const pushBox = (e: { x: number; y: number; width: number; length: number }) =>
      pts.push({ x: e.x, y: e.y }, { x: e.x + e.width, y: e.y + e.length });
    obstacles.forEach((o) => (o.shape === "polygon" && o.points ? pts.push(...o.points) : pushBox(o)));
    fixtures.forEach(pushBox);
    features.forEach(pushBox);
    const b = polygonBounds(pts);
    return { width: Math.max(b.maxX + 0.5, 1), length: Math.max(b.maxY + 0.5, 1) };
  }, [room, obstacles, fixtures, features]);

  const fontSize = Math.min(Math.max(Math.min(view.width, view.length) * 0.035, 0.16), 0.45);

  // ── Chair edits ──
  const adjustChairs = (mappingId: number, delta: number) => {
    setTableChairs((prev) => ({ ...prev, [mappingId]: Math.max(0, (prev[mappingId] ?? 0) + delta) }));
    markDirty();
  };
  const setChairs = (mappingId: number, value: number) => {
    setTableChairs((prev) => ({ ...prev, [mappingId]: Math.max(0, Math.round(value)) }));
    markDirty();
  };

  const toggleMustSee = (id: string) => {
    setMustSee((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    markDirty();
  };

  // ── Manual nudge ──
  const eventToWorld = (e: React.PointerEvent): Point => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const w = screenToWorld(e.clientX, e.clientY, rect, view.width, view.length);
    return { x: clamp(snap(w.x, 0.1), 0, view.width), y: clamp(snap(w.y, 0.1), 0, view.length) };
  };
  const currentPos = (mappingId: number): TableOverride => {
    if (overrides[mappingId]) return overrides[mappingId];
    const p = placementsById.get(mappingId);
    return { x: p?.x ?? 0, y: p?.y ?? 0, rotation: p?.rotation ?? 0 };
  };
  const setOverride = (mappingId: number, patch: Partial<TableOverride>) => {
    setOverrides((prev) => {
      const base = prev[mappingId] ?? currentPos(mappingId);
      return { ...prev, [mappingId]: { ...base, ...patch } };
    });
    markDirty();
  };
  const startDrag = (e: React.PointerEvent, mappingId: number) => {
    e.stopPropagation();
    const w = eventToWorld(e);
    const pos = currentPos(mappingId);
    dragRef.current = { mappingId, grabDX: w.x - pos.x, grabDY: w.y - pos.y };
    setSelectedId(mappingId);
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onSvgPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = eventToWorld(e);
    setOverride(d.mappingId, {
      x: round(clamp(w.x - d.grabDX, 0, view.width)),
      y: round(clamp(w.y - d.grabDY, 0, view.length)),
    });
  };
  const onSvgPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  };
  const rotateSelected = (delta: number) => {
    if (selectedId == null) return;
    const cur = currentPos(selectedId);
    setOverride(selectedId, { rotation: Math.round((((cur.rotation + delta) % 360) + 360) % 360) });
  };
  const resetSelected = () => {
    if (selectedId == null) return;
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    markDirty();
  };

  const regenerate = () => {
    setOverrides({});
    setSelectedId(null);
    markDirty();
    toast.success("Layout re-packed from current settings.");
  };

  // ── Save ──
  const handleSave = () => {
    const layout = {
      version: 1,
      savedAt: new Date().toISOString(),
      settings: { chairZone: round(chairZone), aisleWidth: round(aisleWidth), mustSee },
      tables: result.placements.map((p) => ({
        tableId: p.tableId,
        mappingId: p.mappingId,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        baseSeats: p.baseSeats,
        extraChairs: p.extraChairs,
        sightlines: p.sightlines,
      })),
      stats: result.stats,
    };
    const chairChanges = tables.map((t) => ({ mappingId: t.mappingId, addSeat: tableChairs[t.mappingId] ?? t.extraChairs }));
    startTransition(async () => {
      const res = await saveFloorPlanLayoutAction(event.id, layout, chairChanges);
      if (res?.error) toast.error(res.error);
      else {
        setDirty(false);
        toast.success("Floor plan saved.");
      }
    });
  };

  const eventDate = new Date(event.date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const selectedTable = selectedId != null ? tablesWithChairs.find((t) => t.mappingId === selectedId) ?? null : null;
  const placementsById = useMemo(() => new Map(result.placements.map((p) => [p.mappingId, p])), [result.placements]);

  const hasRoom = !!room && room.points.length >= 3;

  return (
    <div className="p-2 sm:p-4 space-y-4 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/event-setups/events"
            aria-label="Back to events"
            className="h-9 w-9 shrink-0 rounded-xl border border-[#E6DFC8] bg-white flex items-center justify-center text-[#5C4033] hover:bg-[#F7F4EA]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-[#1F1F1A] leading-tight">
              Floor Plan — {event.title}
            </h2>
            <p className="text-[11px] font-bold text-[#5F624F] tabular-nums">{eventDate}</p>
          </div>
        </div>
        {dirty ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            <AlertCircle className="w-3 h-3" /> Unsaved
          </span>
        ) : saved?.savedAt ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2.5 py-1 rounded-lg tabular-nums">
            Saved {new Date(saved.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        ) : null}
      </div>

      {!hasRoom ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center bg-white">
          <Info className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A] uppercase">No venue layout yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">Set up the room shape and fixtures first.</p>
          <Link
            href="/settings/venue"
            className="inline-flex items-center gap-1.5 mt-4 h-10 px-4 rounded-xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] hover:bg-[#5C4033]/85"
          >
            Open Venue Layout
          </Link>
        </div>
      ) : (
        <>
          {/* ── Controls ── */}
          <div className="bg-white border border-[#E6DFC8] rounded-2xl p-3 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <NumField id="chair-zone" label="Chair zone (m)" value={chairZone} min={0} step={0.1} onChange={(v) => { setChairZone(v); markDirty(); }} />
              <div className="space-y-1.5">
                <Label htmlFor="aisle" className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">
                  Aisle width (m)
                </Label>
                <Input
                  id="aisle"
                  type="number"
                  min={0}
                  step={0.1}
                  value={Number.isFinite(aisleWidth) ? aisleWidth : ""}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setAisleWidth(Number.isFinite(n) ? round(Math.max(0, n)) : 0);
                    markDirty();
                  }}
                  className={cn(
                    "h-11 w-full rounded-xl border-2 bg-white px-3 text-sm font-bold tabular-nums focus:border-[#5C4033]",
                    aisleWidth < MIN_AISLE ? "border-amber-400" : "border-[#E6DFC8]"
                  )}
                />
                {aisleWidth < MIN_AISLE && (
                  <p className="text-[10px] font-bold text-amber-700">Below WCAG min {MIN_AISLE} m</p>
                )}
              </div>
            </div>

            {/* Must-see focal multi-select */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Must be visible from every seat
              </p>
              {focals.length === 0 ? (
                <p className="text-[11px] font-bold text-[#5F624F]/70">No focal points (stage / screens / booth) in the venue layout.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {focals.map((f) => {
                    const on = mustSee.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        htmlFor={`ms-${f.id}`}
                        className={cn(
                          "flex items-center gap-2 h-10 px-3 rounded-xl border-2 cursor-pointer font-black uppercase tracking-wide text-[10px] transition-all",
                          on ? "bg-[#5C4033] text-white border-[#5C4033]" : "bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/40"
                        )}
                      >
                        <input id={`ms-${f.id}`} type="checkbox" checked={on} onChange={() => toggleMustSee(f.id)} className="h-4 w-4 rounded accent-[#5C4033]" />
                        {f.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected table chair control */}
            <div className="rounded-xl bg-[#F7F4EA] border border-[#E6DFC8] p-3">
              {selectedTable ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#1F1F1A]">{selectedTable.name}</p>
                      <p className="text-[11px] font-bold text-[#5F624F] tabular-nums">
                        {selectedTable.baseSeats} base + {tableChairs[selectedTable.mappingId] ?? 0} extra ={" "}
                        {selectedTable.baseSeats + (tableChairs[selectedTable.mappingId] ?? 0)} seats
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => adjustChairs(selectedTable.mappingId, -1)} aria-label="Remove a chair" className="h-10 w-10 rounded-xl border-2 border-[#E6DFC8] bg-white flex items-center justify-center text-[#5C4033] hover:bg-[#F0EDE0]">
                        <Minus className="w-4 h-4" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        aria-label="Extra chairs"
                        value={tableChairs[selectedTable.mappingId] ?? 0}
                        onChange={(e) => setChairs(selectedTable.mappingId, parseFloat(e.target.value) || 0)}
                        className="h-10 w-16 rounded-xl border-2 border-[#E6DFC8] bg-white px-2 text-center text-sm font-black tabular-nums focus:border-[#5C4033]"
                      />
                      <button type="button" onClick={() => adjustChairs(selectedTable.mappingId, 1)} aria-label="Add a chair" className="h-10 w-10 rounded-xl bg-[#1B4332] flex items-center justify-center text-white hover:bg-[#1B4332]/85">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#E6DFC8] pt-3">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] flex items-center gap-1"><Move className="w-3 h-3" /> Drag to move</span>
                    {selectedTable.shape === "rect" && (
                      <>
                        <button type="button" onClick={() => rotateSelected(-15)} aria-label="Rotate table left" title="Rotate left" className="h-9 w-9 rounded-xl border-2 border-[#E6DFC8] bg-white flex items-center justify-center text-[#5C4033] hover:bg-[#F0EDE0]">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => rotateSelected(15)} aria-label="Rotate table right" title="Rotate right" className="h-9 w-9 rounded-xl border-2 border-[#E6DFC8] bg-white flex items-center justify-center text-[#5C4033] hover:bg-[#F0EDE0]">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {overrides[selectedTable.mappingId] && (
                      <button type="button" onClick={resetSelected} className="h-9 px-3 rounded-xl border-2 border-[#E6DFC8] bg-white text-[#5F624F] font-black uppercase tracking-wide text-[10px] hover:bg-[#F0EDE0]">
                        Reset position
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-bold text-[#5F624F] flex items-center gap-1.5">
                  <Armchair className="w-3.5 h-3.5 shrink-0" /> Tap a table to add chairs; drag it to nudge its position.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={regenerate} className="h-11 px-4 rounded-xl border-2 border-[#E6DFC8] bg-white text-[#5C4033] font-black uppercase tracking-widest text-[10px] hover:bg-[#F7F4EA]">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
              </Button>
              <Button type="button" onClick={handleSave} disabled={isPending} className="h-11 px-5 rounded-xl bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 disabled:opacity-50">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save layout</>}
              </Button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBadge label="Tables placed" value={`${result.stats.tablesPlaced} / ${tables.length}`} sub={`${availableCount} available`} />
            <StatBadge label="Total seats" value={`${result.stats.totalSeats}`} sub={benchSeats ? `incl ${benchSeats} bench` : undefined} />
            <StatBadge label="Utilisation" value={`${Math.round(result.stats.utilisation * 100)}%`} sub={`${result.stats.roomArea} m²`} />
            <StatBadge
              label="Must-see"
              value={result.stats.mustSeeCompliant ? "Pass" : "Fail"}
              tone={mustSee.length === 0 ? "neutral" : result.stats.mustSeeCompliant ? "good" : "bad"}
            />
          </div>

          {/* ── Warnings ── */}
          {result.warnings.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold",
                    w.level === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
                  )}
                >
                  {w.level === "error" ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Plan ── */}
          <div
            className="w-full rounded-2xl border-2 border-[#E6DFC8] bg-[#FFFDF7] overflow-hidden aspect-(--fp-ar)"
            style={{ "--fp-ar": `${view.width} / ${view.length}` } as React.CSSProperties}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${view.width} ${view.length}`}
              className="w-full h-full select-none touch-none"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerCancel={onSvgPointerUp}
            >
              {/* Room */}
              <polygon
                points={room!.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#5C4033"
                fillOpacity={0.04}
                stroke="#5C4033"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Obstacles */}
              {obstacles.map((o) => {
                const cx = o.x + o.width / 2;
                const cy = o.y + o.length / 2;
                const t = o.rotation && o.shape !== "polygon" ? `rotate(${o.rotation} ${cx} ${cy})` : undefined;
                const common = { fill: "#DC2626", fillOpacity: 0.16, stroke: "#DC2626", strokeWidth: 1.5, strokeDasharray: "4 2", vectorEffect: "non-scaling-stroke" as const };
                return (
                  <g key={o.id} transform={t}>
                    {o.shape === "circle" ? (
                      <ellipse cx={cx} cy={cy} rx={o.width / 2} ry={o.length / 2} {...common} />
                    ) : o.shape === "polygon" && o.points ? (
                      <polygon points={o.points.map((p) => `${p.x},${p.y}`).join(" ")} {...common} strokeLinejoin="round" />
                    ) : (
                      <rect x={o.x} y={o.y} width={o.width} height={o.length} rx={0.05} {...common} />
                    )}
                  </g>
                );
              })}

              {/* Fixtures */}
              {fixtures.map((f) => {
                const cx = f.x + f.width / 2;
                const cy = f.y + f.length / 2;
                const t = f.rotation && f.shape !== "polygon" ? `rotate(${f.rotation} ${cx} ${cy})` : undefined;
                const fill = FIXTURE_FILL[f.type] ?? "#5C4033";
                const arrow = f.facing != null ? facingToVector(f.facing) : null;
                const aLen = Math.min(f.width, f.length) * 0.6 + 0.25;
                return (
                  <g key={f.id}>
                    <g transform={t}>
                      {f.shape === "circle" ? (
                        <ellipse cx={cx} cy={cy} rx={f.width / 2} ry={f.length / 2} fill={fill} fillOpacity={0.85} stroke={fill} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ) : f.shape === "polygon" && f.points ? (
                        <polygon points={f.points.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} fillOpacity={0.85} stroke={fill} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                      ) : (
                        <rect x={f.x} y={f.y} width={f.width} height={f.length} rx={0.05} fill={fill} fillOpacity={0.85} stroke={fill} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      )}
                      <text x={cx} y={cy} fontSize={fontSize} fontWeight={800} fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle">
                        {f.label}
                      </text>
                    </g>
                    {arrow && <line x1={cx} y1={cy} x2={cx + arrow.x * aLen} y2={cy + arrow.y * aLen} stroke="#FDCC4B" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                  </g>
                );
              })}

              {/* Features (benches / doors / windows) */}
              {features.map((f) => {
                const cx = f.x + f.width / 2;
                const cy = f.y + f.length / 2;
                const t = f.rotation ? `rotate(${f.rotation} ${cx} ${cy})` : undefined;
                const fill = f.kind === "bench" ? "#8B6F47" : f.kind === "door" ? "#C8956D" : "#7DD3FC";
                const seatPts = f.kind === "bench" ? benchSeatPositions(f.x, f.y, f.width, f.length, f.facing, f.seats ?? 0) : [];
                const clearance = f.kind === "door" && f.facing != null ? doorClearancePolygon({ x: cx, y: cy }, f.facing, Math.max(f.width, f.length), Math.max(f.width, f.length)) : null;
                return (
                  <g key={f.id}>
                    {clearance && <polygon points={clearance.map((p) => `${p.x},${p.y}`).join(" ")} fill="#C8956D" fillOpacity={0.1} stroke="#A9744F" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
                    <g transform={t}>
                      <rect x={f.x} y={f.y} width={f.width} height={f.length} rx={0.03} fill={fill} fillOpacity={f.kind === "window" ? 0.6 : 0.9} stroke={fill} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      {seatPts.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={0.12} fill="#FFFDF7" stroke="#5C4033" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ))}
                    </g>
                  </g>
                );
              })}

              {/* Tables */}
              {result.placements.map((p) => {
                const span = p.span;
                const r = span / 2;
                const chairR = r + chairZone * 0.45;
                const totalChairs = p.baseSeats + p.extraChairs;
                const chairs = ringPositions(p.x, p.y, chairR, totalChairs);
                const fill = p.worstRating ? RATING_FILL[p.worstRating] : "#5C4033";
                const isSel = selectedId === p.mappingId;
                const bodyTransform = p.shape === "rect" && p.rotation ? `rotate(${p.rotation} ${p.x} ${p.y})` : undefined;
                return (
                  <g key={p.mappingId} className="cursor-move" onPointerDown={(e) => startDrag(e, p.mappingId)}>
                    {/* chairs */}
                    {chairs.map((c, i) => (
                      <circle key={i} cx={c.x} cy={c.y} r={0.13} fill={i >= p.baseSeats ? "#FDCC4B" : "#5C4033"} stroke="#FFFDF7" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    ))}
                    {/* table body */}
                    {p.shape === "rect" ? (
                      <rect transform={bodyTransform} x={p.x - r} y={p.y - r} width={span} height={span} rx={0.06} fill={fill} fillOpacity={0.9} stroke={isSel ? "#1F1F1A" : fill} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                    ) : (
                      <circle cx={p.x} cy={p.y} r={r} fill={fill} fillOpacity={0.9} stroke={isSel ? "#1F1F1A" : fill} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                    )}
                    {/* must-see violation ring */}
                    {p.mustSeeViolation && (
                      <circle cx={p.x} cy={p.y} r={r + 0.18} fill="none" stroke="#DC2626" strokeWidth={2.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                    )}
                    <text x={p.x} y={p.y} fontSize={fontSize * 0.95} fontWeight={800} fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle">
                      {p.baseSeats + p.extraChairs}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ── Legend ── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-[#5F624F]">
            <span className="flex items-center gap-1.5"><Dot color="#16A34A" /> Good view</span>
            <span className="flex items-center gap-1.5"><Dot color="#D97706" /> Acceptable</span>
            <span className="flex items-center gap-1.5"><Dot color="#DC2626" /> Poor</span>
            <span className="flex items-center gap-1.5"><Dot color="#5C4033" /> No focal</span>
            <span className="flex items-center gap-1.5"><Dot color="#FDCC4B" /> Extra chair</span>
            <span className="flex items-center gap-1.5 text-red-600">⊘ Must-see violation</span>
          </div>

          {/* Unplaced tables */}
          {result.unplaced.length > 0 && (
            <p className="text-[11px] font-bold text-amber-700">
              Unplaced: {result.unplaced.map((t) => t.name).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** N points evenly around a circle, starting at the top, clockwise. */
function ringPositions(cx: number, cy: number, radius: number, count: number): Point[] {
  if (count <= 0) return [];
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const a = (-90 + (360 / count) * i) * (Math.PI / 180);
    out.push({ x: round(cx + radius * Math.cos(a), 3), y: round(cy + radius * Math.sin(a), 3) });
  }
  return out;
}

function StatBadge({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 bg-white",
        tone === "good" ? "border-green-200 bg-green-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-[#E6DFC8]"
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">{label}</p>
      <p className={cn("text-lg font-black tabular-nums leading-tight", tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-[#1F1F1A]")}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-bold text-[#5F624F]/70 tabular-nums">{sub}</p>}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-3 h-3 rounded-full bg-(--dot)" style={{ "--dot": color } as React.CSSProperties} aria-hidden="true" />;
}

function NumField({ id, label, value, min = 0, max, step = 0.1, onChange }: { id: string; label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isFinite(n)) return onChange(min);
          let c = Math.max(min, n);
          if (max != null) c = Math.min(max, c);
          onChange(round(c));
        }}
        className="h-11 w-full rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold tabular-nums focus:border-[#5C4033]"
      />
    </div>
  );
}
