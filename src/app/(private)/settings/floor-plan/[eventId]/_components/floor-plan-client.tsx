"use client";

import React, { useMemo, useRef, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trash2,
  LayoutGrid,
  ChevronDown,
  Link2 as LinkIcon,
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
  rotatePoint,
  rectCorners,
  rotatedRectCorners,
} from "@/lib/floor-plan/geometry";
import { layoutLabels, type LabelInput } from "@/lib/floor-plan/labels";
import { computeTableChairs, chairGapFor } from "@/lib/floor-plan/chairs";
import {
  computeFloorPlan,
  focalPointsFrom,
  buildBlockers,
  findFreeSlot,
  tableSlot,
  orientSlot,
  tableFootprint,
  describeSightIssue,
  MIN_AISLE,
  type CalcTable,
  type PackedPosition,
  type SightRating,
  type Slot,
  type TableOverride,
} from "@/lib/floor-plan/calculator";
import type { ChairLayout, Feature, Fixture, Obstacle, Point, RoomOutline } from "@/lib/floor-plan/types";
import {
  saveFloorPlanLayoutAction,
  addEventTableAction,
  addEventTablesAction,
  removeEventTableAction,
} from "../actions";

export type AvailableTable = {
  tableId: number;
  name: string;
  shape: "round" | "rect";
  diameter: number | null;
  width: number | null;
  length: number | null;
  baseSeats: number;
  chairLayout: ChairLayout | null;
  inUse: boolean;
};

export type TableParty = {
  mappingId: number;
  name: string | null;
  size: number;
  capacity: number;
};

const RATING_FILL: Record<SightRating, string> = { good: "#16A34A", acceptable: "#D97706", poor: "#DC2626" };
const RATING_ORDER: Record<SightRating, number> = { good: 0, acceptable: 1, poor: 2 };
const FIXTURE_FILL: Record<string, string> = {
  stage: "#4338CA",
  bar: "#34451F",
  dj_booth: "#7C3AED",
  projector: "#0EA5E9",
  tv: "#0D9488",
};
const FIXTURE_INK: Record<string, string> = {
  stage: "#3730A3",
  bar: "#34451F",
  dj_booth: "#6D28D9",
  projector: "#0284C7",
  tv: "#0F766E",
};

type SavedLayout = {
  settings?: { chairZone?: number; aisleWidth?: number; mustSee?: string[] };
  tables?: Array<{ mappingId: number; extraChairs?: number; x?: number; y?: number; rotation?: number }>;
  attached?: number[][];
  savedAt?: string;
} | null;

export default function FloorPlanClient({
  event,
  room,
  obstacles,
  fixtures,
  features,
  tables,
  parties,
  availableTables,
  availableCount,
  savedLayout,
}: {
  event: { id: number; title: string; date: string };
  room: RoomOutline | null;
  obstacles: Obstacle[];
  fixtures: Fixture[];
  features: Feature[];
  tables: CalcTable[];
  parties: TableParty[];
  availableTables: AvailableTable[];
  availableCount: number;
  savedLayout: SavedLayout;
}) {
  const saved = savedLayout ?? null;
  const router = useRouter();

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
  const [attachGroups, setAttachGroups] = useState<number[][]>(() => saved?.attached ?? []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showPool, setShowPool] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isMutating, startMutate] = useTransition();
  const [autoFillTick, setAutoFillTick] = useState(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ mappingId: number; grabDX: number; grabDY: number } | null>(null);

  const markDirty = () => setDirty(true);

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
  const addableTables = useMemo(() => availableTables.filter((t) => !t.inUse), [availableTables]);

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
        spareTables: addableTables,
      }),
    [room, blockers, focals, tablesWithChairs, addableTables, availableCount, benchSeats, chairZone, aisleWidth, mustSee, overrides]
  );

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
  const labelSize = clamp(Math.min(view.width, view.length) * 0.021, 0.1, 0.24);

  const partyByMapping = useMemo(() => new Map(parties.map((p) => [p.mappingId, p])), [parties]);

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
  const groupOf = (mappingId: number): number[] | null =>
    attachGroups.find((g) => g.includes(mappingId)) ?? null;

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = eventToWorld(e);
    const nx = round(clamp(w.x - d.grabDX, 0, view.width));
    const ny = round(clamp(w.y - d.grabDY, 0, view.length));
    const group = groupOf(d.mappingId);
    if (group && group.length > 1) {
      const cur = currentPos(d.mappingId);
      const dx = nx - cur.x;
      const dy = ny - cur.y;
      if (dx === 0 && dy === 0) return;
      setOverrides((prev) => {
        const next = { ...prev };
        for (const id of group) {
          const base = prev[id] ?? currentPos(id);
          next[id] = {
            ...base,
            x: round(clamp(base.x + dx, 0, view.width)),
            y: round(clamp(base.y + dy, 0, view.length)),
          };
        }
        return next;
      });
      markDirty();
    } else {
      setOverride(d.mappingId, { x: nx, y: ny });
    }
  };
  const onSvgPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
      }
      setAutoFillTick((t) => t + 1);
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

  const attachSelected = () => {
    if (selectedId == null) return;
    const me = currentPos(selectedId);
    const others = result.placements.filter((p) => p.mappingId !== selectedId);
    if (others.length === 0) return toast.info("No other table to attach to.");
    let nearest = others[0];
    let best = Infinity;
    for (const p of others) {
      const c = currentPos(p.mappingId);
      const d = Math.hypot(c.x - me.x, c.y - me.y);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    setAttachGroups((prev) => {
      const members = new Set<number>([selectedId]);
      for (const g of prev) {
        if (g.includes(selectedId) || g.includes(nearest.mappingId)) g.forEach((id) => members.add(id));
      }
      members.add(nearest.mappingId);
      const rest = prev.filter((g) => !g.includes(selectedId) && !g.includes(nearest.mappingId));
      return [...rest, Array.from(members)];
    });
    markDirty();
    toast.success(`Attached to ${nearest.name}.`);
  };
  const detachSelected = () => {
    if (selectedId == null) return;
    setAttachGroups((prev) =>
      prev
        .map((g) => (g.includes(selectedId) ? g.filter((id) => id !== selectedId) : g))
        .filter((g) => g.length >= 2)
    );
    markDirty();
  };

  const emptyCells = Math.max(0, result.cellsAvailable - result.placements.length);

  const addTable = (tableId: number) => {
    startMutate(async () => {
      const res = await addEventTableAction(event.id, tableId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Table added.");
        router.refresh();
      }
    });
  };
  const removeTable = (mappingId: number) => {
    startMutate(async () => {
      const res = await removeEventTableAction(event.id, mappingId);
      if (res?.error) toast.error(res.error);
      else {
        setSelectedId(null);
        toast.success("Table removed.");
        router.refresh();
      }
    });
  };
  const fillEmptySpace = () => {
    if (emptyCells <= 0) return toast.info("No empty space to fill.");
    if (addableTables.length === 0) return toast.info("No more available tables to add.");
    const ids = addableTables.slice(0, emptyCells).map((t) => t.tableId);
    startMutate(async () => {
      const res = await addEventTablesAction(event.id, ids);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Added ${res.added ?? ids.length} table${(res.added ?? ids.length) === 1 ? "" : "s"} to fill space.`);
        router.refresh();
      }
    });
  };

  const findFreeCell = (slot: Slot): PackedPosition | null => {
    if (!room || room.points.length < 3) return null;
    const occupied = result.placements.map((p) =>
      tableFootprint({ x: p.x, y: p.y }, orientSlot(tableSlot(p, chairZone), p.rotation))
    );
    return findFreeSlot(room.points, blockers, occupied, slot, aisleWidth);
  };

  useEffect(() => {
    if (autoFillTick === 0 || isMutating) return;
    if (addableTables.length === 0) return;
    const cell = findFreeCell(tableSlot(addableTables[0], chairZone));
    if (!cell) return;
    const tableId = addableTables[0].tableId;
    startMutate(async () => {
      const res = await addEventTableAction(event.id, tableId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.mappingId != null) {
        setOverrides((prev) => ({ ...prev, [res.mappingId as number]: cell }));
      }
      markDirty();
      toast.success("Added the next table to the freed space.");
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillTick]);

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
      attached: attachGroups,
      stats: { ...result.stats, totalSeats: displayedTotalSeats, benchSeatsDocked: tableVisuals.usedBenchSeats },
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

  const tableVisuals = useMemo(() => {
    const benchBoxes = features
      .filter((f) => f.kind === "bench")
      .map((f) => ({
        id: f.id,
        seats: f.seats ?? 0,
        pad: Math.max(0.25, chairZone * 0.6),
        box: { minX: f.x, minY: f.y, maxX: f.x + f.width, maxY: f.y + f.length },
      }));
    const usedBenchIds = new Set<string>();
    const byMapping = new Map<number, { chairs: { x: number; y: number; extra: boolean }[]; benches: { x: number; y: number; width: number; length: number }[] }>();

    for (const p of result.placements) {
      const { chairs, benches } = computeTableChairs({
        shape: p.shape,
        cx: p.x,
        cy: p.y,
        width: p.width,
        length: p.length,
        diameter: p.diameter,
        chairGap: chairGapFor(chairZone),
        baseSeats: p.baseSeats,
        extraChairs: p.extraChairs,
        layout: p.chairLayout,
      });
      const kept = chairs.filter((c) => {
        const w = p.rotation ? rotatePoint(c, { x: p.x, y: p.y }, p.rotation) : c;
        const hit = benchBoxes.find(
          (b) => w.x >= b.box.minX - b.pad && w.x <= b.box.maxX + b.pad && w.y >= b.box.minY - b.pad && w.y <= b.box.maxY + b.pad
        );
        if (hit) {
          usedBenchIds.add(hit.id);
          return false; // bench serves this seat
        }
        return true;
      });
      byMapping.set(p.mappingId, { chairs: kept, benches });
    }
    const usedBenchSeats = benchBoxes.filter((b) => usedBenchIds.has(b.id)).reduce((s, b) => s + b.seats, 0);
    return { byMapping, usedBenchIds, usedBenchSeats };
  }, [result.placements, features, chairZone]);

  const displayedTotalSeats = result.stats.totalSeats - tableVisuals.usedBenchSeats;
  const standaloneBenchSeats = benchSeats - tableVisuals.usedBenchSeats;

  const seatReports = useMemo(
    () =>
      result.placements
        .map((p) => {
          const bad = p.seats.filter((s) => s.rating !== "good");
          if (bad.length === 0) return null;
          const grouped = new Map<string, { rating: SightRating; text: string; count: number }>();
          for (const s of bad) {
            const text = describeSightIssue(s.issue, s.focalLabel ?? "the focal point");
            const key = `${s.rating}|${text}`;
            const hit = grouped.get(key);
            if (hit) hit.count += 1;
            else grouped.set(key, { rating: s.rating, text, count: 1 });
          }
          return {
            name: p.name,
            total: p.seats.length,
            bad: bad.length,
            reasons: [...grouped.values()].sort((a, b) => RATING_ORDER[b.rating] - RATING_ORDER[a.rating]),
          };
        })
        .filter((r) => r !== null),
    [result.placements]
  );

  const labels = useMemo(() => {
    const boxOf = (e: { x: number; y: number; width: number; length: number; rotation?: number; shape?: string; points?: Point[] }) =>
      e.shape === "polygon" && e.points?.length
        ? polygonBounds(e.points)
        : polygonBounds(
            e.rotation
              ? rotatedRectCorners(e.x, e.y, e.width, e.length, e.rotation)
              : rectCorners(e.x, e.y, e.width, e.length)
          );

    const items: LabelInput[] = [
      ...obstacles.map((o) => ({
        key: `ob-${o.id}`,
        text: o.label,
        bounds: boxOf(o),
        width: o.width,
        length: o.length,
        rotation: o.rotation ?? 0,
        outsideOnly: o.shape === "polygon",
        ink: "#991B1B",
      })),
      ...fixtures.map((f) => ({
        key: `fx-${f.id}`,
        text: f.label,
        bounds: boxOf(f),
        width: f.width,
        length: f.length,
        rotation: f.rotation ?? 0,
        outsideOnly: f.shape === "polygon",
        ink: FIXTURE_INK[f.type] ?? "#34451F",
      })),
      ...features.map((f) => ({
        key: `ft-${f.id}`,
        text: f.kind === "bench" ? `${f.label} (${f.seats ?? 0})` : f.label,
        bounds: boxOf(f),
        width: f.width,
        length: f.length,
        rotation: f.rotation ?? 0,
        outsideOnly: false,
        ink: "#34451F",
      })),
      ...result.placements.map((p) => {
        const party = partyByMapping.get(p.mappingId);
        const w = p.shape === "round" ? p.diameter : p.width;
        const l = p.shape === "round" ? p.diameter : p.length;
        return {
          key: `tb-${p.mappingId}`,
          text: party?.name ?? `Table ${p.name}`,
          bounds: polygonBounds(
            p.rotation
              ? rotatedRectCorners(p.x - w / 2, p.y - l / 2, w, l, p.rotation)
              : rectCorners(p.x - w / 2, p.y - l / 2, w, l)
          ),
          width: w,
          length: l,
          rotation: p.rotation,
          outsideOnly: true, // the middle already carries the occupancy figure
          ink: "#20231A",
        };
      }),
    ];
    return layoutLabels(items, { fontSize: labelSize, viewWidth: view.width });
  }, [obstacles, fixtures, features, result.placements, partyByMapping, labelSize, view.width]);

  const hasRoom = !!room && room.points.length >= 3;
  const mustSeeLabels = focals
    .filter((f) => mustSee.includes(f.id))
    .map((f) => f.label)
    .join(", ");

  return (
    <div className="max-w-5xl space-y-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/event-setups/events"
            aria-label="Back to events"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D8D5C8] bg-white text-[#34451F] hover:bg-[#F4F1E8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="font-black text-base leading-tight tracking-tight text-[#20231A] uppercase">
              Floor Plan - {event.title}
            </h2>
            <p className="text-[11px] font-bold text-[#5E6654] tabular-nums">{eventDate}</p>
          </div>
        </div>
        {dirty ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-black text-[10px] tracking-widest text-amber-700 uppercase">
            <AlertCircle className="h-3 w-3" /> Unsaved
          </span>
        ) : saved?.savedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2.5 py-1 font-black text-[10px] tracking-widest text-[#5E6654] uppercase tabular-nums">
            Saved {new Date(saved.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        ) : null}
      </div>

      {!hasRoom ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] bg-white py-14 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="font-black text-sm text-[#20231A] uppercase">No venue layout yet</p>
          <p className="mt-1 text-[11px] text-[#5E6654]">Set up the room shape and fixtures first.</p>
          <Link
            href="/settings/venue"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#34451F] px-4 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#283719]"
          >
            Open Venue Layout
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4 rounded-2xl border border-[#D8D5C8] bg-white p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField id="chair-zone" label="Chair zone (m)" value={chairZone} min={0} step={0.1} onChange={(v) => { setChairZone(v); markDirty(); }} />
              <div className="space-y-1.5">
                <Label htmlFor="aisle" className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
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
                    "h-11 w-full rounded-xl border-2 bg-white px-3 text-sm font-bold tabular-nums focus:border-[#34451F]",
                    aisleWidth < MIN_AISLE ? "border-amber-400" : "border-[#D8D5C8]"
                  )}
                />
                {aisleWidth < MIN_AISLE && (
                  <p className="text-[10px] font-bold text-amber-700">Below WCAG min {MIN_AISLE} m</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                <Eye className="h-3.5 w-3.5" /> Must be visible from every seat
              </p>
              {focals.length === 0 ? (
                <p className="text-[11px] font-bold text-[#5E6654]/70">No focal points (stage / screens / booth) in the venue layout.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {focals.map((f) => {
                    const on = mustSee.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        htmlFor={`ms-${f.id}`}
                        className={cn(
                          "flex h-10 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 font-black text-[10px] tracking-wide uppercase transition-all",
                          on ? "border-[#34451F] bg-[#34451F] text-white" : "border-[#D8D5C8] bg-white text-[#5E6654] hover:border-[#34451F]/40"
                        )}
                      >
                        <input id={`ms-${f.id}`} type="checkbox" checked={on} onChange={() => toggleMustSee(f.id)} className="h-4 w-4 rounded accent-[#34451F]" />
                        {f.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] p-3">
              {selectedTable ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-sm text-[#20231A]">{selectedTable.name}</p>
                      <p className="text-[11px] font-bold text-[#5E6654] tabular-nums">
                        {selectedTable.baseSeats} base + {tableChairs[selectedTable.mappingId] ?? 0} extra ={" "}
                        {selectedTable.baseSeats + (tableChairs[selectedTable.mappingId] ?? 0)} seats
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => adjustChairs(selectedTable.mappingId, -1)} aria-label="Remove a chair" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#D8D5C8] bg-white text-[#34451F] hover:bg-[#F0EDE0]">
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        aria-label="Extra chairs"
                        value={tableChairs[selectedTable.mappingId] ?? 0}
                        onChange={(e) => setChairs(selectedTable.mappingId, parseFloat(e.target.value) || 0)}
                        className="h-10 w-16 rounded-xl border-2 border-[#D8D5C8] bg-white px-2 text-center font-black text-sm tabular-nums focus:border-[#34451F]"
                      />
                      <button type="button" onClick={() => adjustChairs(selectedTable.mappingId, 1)} aria-label="Add a chair" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#34451F] text-white hover:bg-[#283719]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#D8D5C8] pt-3">
                    <span className="flex items-center gap-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"><Move className="h-3 w-3" /> Drag to move</span>
                    {selectedTable.shape === "rect" && (
                      <>
                        <button type="button" onClick={() => rotateSelected(-15)} aria-label="Rotate table left" title="Rotate left" className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#D8D5C8] bg-white text-[#34451F] hover:bg-[#F0EDE0]">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => rotateSelected(15)} aria-label="Rotate table right" title="Rotate right" className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#D8D5C8] bg-white text-[#34451F] hover:bg-[#F0EDE0]">
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {overrides[selectedTable.mappingId] && (
                      <button type="button" onClick={resetSelected} className="h-9 rounded-xl border-2 border-[#D8D5C8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5E6654] uppercase hover:bg-[#F0EDE0]">
                        Reset position
                      </button>
                    )}
                    {groupOf(selectedTable.mappingId) ? (
                      <button type="button" onClick={detachSelected} className="h-9 rounded-xl border-2 border-[#D8D5C8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5E6654] uppercase hover:bg-[#F0EDE0]">
                        Detach
                      </button>
                    ) : (
                      <button type="button" onClick={attachSelected} className="flex h-9 items-center gap-1.5 rounded-xl border-2 border-[#D8D5C8] bg-white px-3 font-black text-[10px] tracking-wide text-[#34451F] uppercase hover:bg-[#F0EDE0]">
                        <LinkIcon className="h-3.5 w-3.5" /> Attach
                      </button>
                    )}
                    {selectedTable.isManual && (
                      <button type="button" onClick={() => removeTable(selectedTable.mappingId)} disabled={isMutating} className="flex h-9 items-center gap-1.5 rounded-xl border-2 border-red-200 bg-white px-3 font-black text-[10px] tracking-wide text-red-600 uppercase hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> Remove table
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#5E6654]">
                  <Armchair className="h-3.5 w-3.5 shrink-0" /> Tap a table to add chairs; drag it to nudge its position.
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowPool((s) => !s)}
                  className="flex items-center gap-1.5 font-black text-[10px] tracking-wide text-[#34451F] uppercase"
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Available tables ({addableTables.length})
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPool && "rotate-180")} />
                </button>
                <Button
                  type="button"
                  onClick={fillEmptySpace}
                  disabled={isMutating || emptyCells <= 0 || addableTables.length === 0}
                  className="h-9 rounded-xl bg-[#34451F] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#283719] disabled:opacity-40"
                >
                  {isMutating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="mr-1 h-3.5 w-3.5" /> Fill empty space ({emptyCells})</>}
                </Button>
              </div>
              {showPool && (
                addableTables.length === 0 ? (
                  <p className="text-[11px] font-bold text-[#5E6654]/70">Every available table is already on this event.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addableTables.map((t) => (
                      <button
                        key={t.tableId}
                        type="button"
                        onClick={() => addTable(t.tableId)}
                        disabled={isMutating}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-[#D8D5C8] bg-white px-3 text-[11px] font-bold text-[#34451F] hover:border-[#34451F] disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t.name}
                        <span className="text-[#5E6654] tabular-nums">· {t.baseSeats}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={regenerate} className="h-11 rounded-xl border-2 border-[#D8D5C8] bg-white px-4 font-black text-[10px] tracking-widest text-[#34451F] uppercase hover:bg-[#F4F1E8]">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
              </Button>
              <Button type="button" onClick={handleSave} disabled={isPending} className="h-11 rounded-xl bg-[#34451F] px-5 font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#283719] active:scale-95 disabled:opacity-50">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save layout</>}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatBadge label="Tables placed" value={`${result.stats.tablesPlaced} / ${tables.length}`} sub={`${availableCount} available`} />
            <StatBadge
              label="Total seats"
              value={`${displayedTotalSeats}`}
              sub={
                tableVisuals.usedBenchSeats > 0
                  ? `${tableVisuals.usedBenchSeats} via docked bench`
                  : standaloneBenchSeats > 0
                    ? `incl ${standaloneBenchSeats} bench`
                    : undefined
              }
            />
            <StatBadge label="Utilisation" value={`${Math.round(result.stats.utilisation * 100)}%`} sub={`${result.stats.roomArea} m²`} />
            <StatBadge
              label="Must-see"
              value={result.stats.mustSeeCompliant ? "Pass" : "Fail"}
              tone={mustSee.length === 0 ? "neutral" : result.stats.mustSeeCompliant ? "good" : "bad"}
            />
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold",
                    w.level === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  {w.level === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <div
            className="aspect-(--fp-ar) w-full overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-[#FFFEFA]"
            style={{ "--fp-ar": `${view.width} / ${view.length}` } as React.CSSProperties}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${view.width} ${view.length}`}
              className="h-full w-full touch-none select-none"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerCancel={onSvgPointerUp}
            >
              <polygon
                points={room!.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#34451F"
                fillOpacity={0.04}
                stroke="#34451F"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

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

              {fixtures.map((f) => {
                const cx = f.x + f.width / 2;
                const cy = f.y + f.length / 2;
                const t = f.rotation && f.shape !== "polygon" ? `rotate(${f.rotation} ${cx} ${cy})` : undefined;
                const fill = FIXTURE_FILL[f.type] ?? "#34451F";
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
                    </g>
                    {arrow && <line x1={cx} y1={cy} x2={cx + arrow.x * aLen} y2={cy + arrow.y * aLen} stroke="#FDCC4B" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                  </g>
                );
              })}

              {features.map((f) => {
                const cx = f.x + f.width / 2;
                const cy = f.y + f.length / 2;
                const t = f.rotation ? `rotate(${f.rotation} ${cx} ${cy})` : undefined;
                const docked = f.kind === "bench" && tableVisuals.usedBenchIds.has(f.id);
                const fill = f.kind === "bench" ? "#8B6F47" : f.kind === "door" ? "#C8956D" : "#7DD3FC";
                const seatPts = f.kind === "bench" ? benchSeatPositions(f.x, f.y, f.width, f.length, f.facing, f.seats ?? 0) : [];
                const clearance = f.kind === "door" && f.facing != null ? doorClearancePolygon({ x: cx, y: cy }, f.facing, Math.max(f.width, f.length), Math.max(f.width, f.length)) : null;
                return (
                  <g key={f.id}>
                    {clearance && <polygon points={clearance.map((p) => `${p.x},${p.y}`).join(" ")} fill="#C8956D" fillOpacity={0.1} stroke="#A9744F" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
                    <g transform={t}>
                      <rect x={f.x} y={f.y} width={f.width} height={f.length} rx={0.03} fill={fill} fillOpacity={f.kind === "window" ? 0.6 : 0.9} stroke={docked ? "#34451F" : fill} strokeWidth={docked ? 2.5 : 1} vectorEffect="non-scaling-stroke" />
                      {seatPts.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={0.12} fill="#FFFEFA" stroke="#34451F" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ))}
                    </g>
                  </g>
                );
              })}

              {attachGroups.map((g, gi) => {
                const members = g.map((id) => placementsById.get(id)).filter(Boolean) as typeof result.placements;
                if (members.length < 2) return null;
                const pts = members.flatMap((p) => {
                  const w = p.shape === "round" ? p.diameter : p.width;
                  const l = p.shape === "round" ? p.diameter : p.length;
                  return [
                    { x: p.x - w / 2, y: p.y - l / 2 },
                    { x: p.x + w / 2, y: p.y + l / 2 },
                  ];
                });
                const b = polygonBounds(pts);
                const pad = 0.2;
                return (
                  <rect
                    key={`grp${gi}`}
                    x={b.minX - pad}
                    y={b.minY - pad}
                    width={b.width + pad * 2}
                    height={b.length + pad * 2}
                    rx={0.2}
                    fill="#34451F"
                    fillOpacity={0.06}
                    stroke="#34451F"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

              {result.placements.map((p) => {
                const rating = p.mustSeeRating ?? p.worstRating;
                const fill = rating ? RATING_FILL[rating] : "#34451F";
                const isSel = selectedId === p.mappingId;
                const transform = p.rotation ? `rotate(${p.rotation} ${p.x} ${p.y})` : undefined;
                const w = p.shape === "round" ? p.diameter : p.width;
                const l = p.shape === "round" ? p.diameter : p.length;
                const ringR = Math.max(w, l) / 2 + 0.18;
                const vis = tableVisuals.byMapping.get(p.mappingId);
                const chairs = vis?.chairs ?? [];
                const benches = vis?.benches ?? [];
                const party = partyByMapping.get(p.mappingId);
                const capacity = party?.capacity || p.baseSeats + p.extraChairs;
                const occupancy = party ? `${party.size}/${capacity}` : `${p.baseSeats + p.extraChairs}`;
                return (
                  <g key={p.mappingId} className="cursor-move" onPointerDown={(e) => startDrag(e, p.mappingId)}>
                    <g transform={transform}>
                      {benches.map((b, i) => (
                        <rect key={`b${i}`} x={b.x} y={b.y} width={b.width} height={b.length} rx={0.06} fill="#8B6F47" fillOpacity={0.9} stroke="#34451F" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ))}
                      {chairs.map((c, i) => (
                        <circle key={`c${i}`} cx={c.x} cy={c.y} r={0.13} fill={c.extra ? "#FDCC4B" : "#34451F"} stroke="#FFFEFA" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ))}
                      {p.shape === "rect" ? (
                        <rect x={p.x - w / 2} y={p.y - l / 2} width={w} height={l} rx={0.06} fill={fill} fillOpacity={0.9} stroke={isSel ? "#20231A" : fill} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                      ) : (
                        <circle cx={p.x} cy={p.y} r={p.diameter / 2} fill={fill} fillOpacity={0.9} stroke={isSel ? "#20231A" : fill} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                      )}
                      <text x={p.x} y={p.y} fontSize={fontSize * 0.9} fontWeight={800} fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle">
                        {occupancy}
                      </text>
                    </g>
                    {p.seats
                      .filter((s) => s.rating !== "good")
                      .map((s, i) => (
                        <circle
                          key={`s${i}`}
                          cx={s.x}
                          cy={s.y}
                          r={0.22}
                          fill="none"
                          stroke={RATING_FILL[s.rating]}
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    {p.mustSeeViolation && (
                      <circle cx={p.x} cy={p.y} r={ringR} fill="none" stroke="#DC2626" strokeWidth={2.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                    )}
                  </g>
                );
              })}

              <g className="pointer-events-none">
                {labels.map((s) =>
                  s.inside ? (
                    <text
                      key={s.key}
                      x={s.x}
                      y={s.y}
                      fontSize={labelSize}
                      fontWeight={700}
                      fill={s.ink}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      paintOrder="stroke"
                      stroke="#FFFEFA"
                      strokeWidth={labelSize * 0.28}
                      strokeLinejoin="round"
                    >
                      {s.text}
                    </text>
                  ) : (
                    <g key={s.key}>
                      <line x1={s.cx} y1={s.cy} x2={s.x} y2={s.y} stroke={s.ink} strokeWidth={1} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
                      <rect
                        x={s.x - s.w / 2}
                        y={s.y - s.h / 2}
                        width={s.w}
                        height={s.h}
                        rx={s.h * 0.35}
                        fill="#FFFEFA"
                        fillOpacity={0.95}
                        stroke={s.ink}
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text x={s.x} y={s.y} fontSize={labelSize} fontWeight={700} fill={s.ink} textAnchor="middle" dominantBaseline="central">
                        {s.text}
                      </text>
                    </g>
                  )
                )}
              </g>
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-[#5E6654]">
            <span className="text-[#20231A]">
              {mustSeeLabels ? `View of ${mustSeeLabels}:` : "Worst view of any focal point:"}
            </span>
            <span className="flex items-center gap-1.5"><Dot color="#16A34A" /> Good view</span>
            <span className="flex items-center gap-1.5"><Dot color="#D97706" /> Acceptable</span>
            <span className="flex items-center gap-1.5"><Dot color="#DC2626" /> Poor</span>
            <span className="flex items-center gap-1.5"><Dot color="#34451F" /> No focal</span>
            <span className="flex items-center gap-1.5"><Dot color="#FDCC4B" /> Extra chair</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-red-600" aria-hidden="true" /> Ringed seat = poor view
            </span>
            <span className="flex items-center gap-1.5 text-red-600">⊘ Must-see violation</span>
            <span className="flex items-center gap-1.5"><Dot color="#34451F" /> Attached / docked bench</span>
          </div>

          {seatReports.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-[#D8D5C8] bg-white p-3">
              <p className="flex items-center gap-1.5 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                <Eye className="h-3.5 w-3.5" /> Seats without a good view
                {mustSeeLabels && <span className="normal-case tracking-normal">of {mustSeeLabels}</span>}
              </p>
              <ul className="space-y-2">
                {seatReports.map((r) => (
                  <li key={r.name} className="rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] p-2.5">
                    <p className="font-black text-[13px] text-[#20231A] tabular-nums">
                      Table {r.name} · {r.bad} of {r.total} seats
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {r.reasons.map((reason) => (
                        <li key={reason.text} className="flex items-start gap-1.5 text-[11px] font-bold text-[#5E6654]">
                          <Dot color={RATING_FILL[reason.rating]} />
                          <span>
                            {reason.count} seat{reason.count === 1 ? "" : "s"} · {reason.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

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


function StatBadge({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3",
        tone === "good" ? "border-green-200 bg-green-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-[#D8D5C8]"
      )}
    >
      <p className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">{label}</p>
      <p className={cn("font-black text-lg leading-tight tabular-nums", tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-[#20231A]")}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-bold text-[#5E6654]/70 tabular-nums">{sub}</p>}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 rounded-full bg-(--dot)" style={{ "--dot": color } as React.CSSProperties} aria-hidden="true" />;
}

function NumField({ id, label, value, min = 0, max, step = 0.1, onChange }: { id: string; label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">{label}</Label>
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
        className="h-11 w-full rounded-xl border-2 border-[#D8D5C8] bg-white px-3 text-sm font-bold tabular-nums focus:border-[#34451F]"
      />
    </div>
  );
}
