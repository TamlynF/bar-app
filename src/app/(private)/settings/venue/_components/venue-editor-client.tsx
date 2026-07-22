"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pentagon,
  Ban,
  Sofa,
  DoorOpen,
  Save,
  Loader2,
  Trash2,
  RotateCcw,
  RotateCw,
  Plus,
  AlertCircle,
  CheckCircle2,
  Info,
  Square as SquareIcon,
  Circle as CircleIcon,
  Spline,
  RectangleHorizontal,
  Armchair,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clamp,
  snap,
  round,
  polygonBounds,
  defaultRoomOutline,
  polygonArea,
  facingToVector,
  screenToWorld,
  doorClearancePolygon,
  benchSeatPositions,
  rectCorners,
} from "@/lib/floor-plan/geometry";
import type {
  Feature,
  FeatureKind,
  Fixture,
  FixtureType,
  Obstacle,
  Point,
  RoomOutline,
  VenueGeometry,
} from "@/lib/floor-plan/types";
import { saveVenueLayoutAction } from "../actions";

type Mode = "outline" | "obstacles" | "fixtures" | "features";
type Shape = "rect" | "circle" | "polygon";
const GRID = 0.1; // snap step (m)
const MIN_SIZE = 0.2; // smallest element dimension (m)

const FIXTURE_META: Record<
  FixtureType,
  { label: string; w: number; l: number; facing: number | null; fill: string; stroke: string }
> = {
  stage: { label: "Stage", w: 4, l: 1.5, facing: 180, fill: "#4338CA", stroke: "#3730A3" },
  bar: { label: "Bar", w: 4, l: 0.8, facing: null, fill: "#5C4033", stroke: "#42301F" },
  dj_booth: { label: "DJ Booth", w: 1.5, l: 1, facing: 180, fill: "#7C3AED", stroke: "#6D28D9" },
  projector: { label: "Projector", w: 0.5, l: 0.3, facing: 180, fill: "#0EA5E9", stroke: "#0284C7" },
  tv: { label: "TV", w: 1.2, l: 0.15, facing: 180, fill: "#0D9488", stroke: "#0F766E" },
};
const FIXTURE_ORDER: FixtureType[] = ["stage", "bar", "dj_booth", "projector", "tv"];

const FEATURE_META: Record<
  FeatureKind,
  { label: string; w: number; l: number; facing: number | null; seats?: number; fill: string; stroke: string }
> = {
  door: { label: "Door", w: 0.9, l: 0.15, facing: 180, fill: "#C8956D", stroke: "#A9744F" },
  window: { label: "Window", w: 1.2, l: 0.1, facing: null, fill: "#7DD3FC", stroke: "#0EA5E9" },
  bench: { label: "Bench", w: 1.6, l: 0.45, facing: 0, seats: 3, fill: "#8B6F47", stroke: "#5C4033" },
};

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

const shapeOf = (s?: Shape): Shape => s ?? "rect";
const rotOf = (r?: number): number => r ?? 0;
function rotTransform(rotation: number, cx: number, cy: number, shape: Shape): string | undefined {
  return shape !== "polygon" && rotation ? `rotate(${rotation} ${round(cx, 3)} ${round(cy, 3)})` : undefined;
}

type Selection =
  | { kind: "vertex"; index: number }
  | { kind: "obstacle"; id: string }
  | { kind: "obstacleVertex"; id: string; index: number }
  | { kind: "fixture"; id: string }
  | { kind: "fixtureVertex"; id: string; index: number }
  | { kind: "feature"; id: string }
  | null;

type DragState =
  | { kind: "vertex"; index: number }
  | { kind: "obstacle"; id: string; grabDX: number; grabDY: number }
  | { kind: "obstacleVertex"; id: string; index: number }
  | { kind: "fixture"; id: string; grabDX: number; grabDY: number }
  | { kind: "fixtureVertex"; id: string; index: number }
  | { kind: "feature"; id: string; grabDX: number; grabDY: number }
  | null;

export default function VenueEditorClient({
  companyId,
  companyName,
  initialRoom,
  initialObstacles,
  initialFixtures,
  initialFeatures,
}: {
  companyId: number | null;
  companyName: string | null;
  initialRoom: RoomOutline | null;
  initialObstacles: Obstacle[];
  initialFixtures: Fixture[];
  initialFeatures: Feature[];
}) {
  const [mode, setMode] = useState<Mode>("outline");
  const [roomW, setRoomW] = useState<number>(initialRoom?.width ?? 10);
  const [roomL, setRoomL] = useState<number>(initialRoom?.length ?? 8);
  const [points, setPoints] = useState<Point[]>(initialRoom?.points ?? []);
  const [obstacles, setObstacles] = useState<Obstacle[]>(
    () => initialObstacles.map((o) => ({ rotation: 0, ...o }))
  );
  const [fixtures, setFixtures] = useState<Fixture[]>(
    () => initialFixtures.map((f) => ({ shape: "rect" as Shape, rotation: 0, ...f }))
  );
  const [features, setFeatures] = useState<Feature[]>(
    () => initialFeatures.map((f) => ({ rotation: 0, ...f }))
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [drawingPoly, setDrawingPoly] = useState<Point[] | null>(null);

  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState>(null);

  const view = useMemo(() => {
    const bboxPts = (e: { x: number; y: number; width: number; length: number; shape?: Shape; points?: Point[] }) =>
      shapeOf(e.shape) === "polygon" && e.points
        ? e.points
        : [
            { x: e.x, y: e.y },
            { x: e.x + e.width, y: e.y + e.length },
          ];
    const all: Point[] = [
      { x: 0, y: 0 },
      { x: roomW, y: roomL },
      ...points,
      ...obstacles.flatMap(bboxPts),
      ...fixtures.flatMap(bboxPts),
      ...features.flatMap((f) => [
        { x: f.x, y: f.y },
        { x: f.x + f.width, y: f.y + f.length },
      ]),
    ];
    const b = polygonBounds(all);
    const pad = 0.5;
    return { width: Math.max(b.maxX + pad, 1), length: Math.max(b.maxY + pad, 1) };
  }, [roomW, roomL, points, obstacles, fixtures, features]);

  const markDirty = () => {
    setDirty(true);
    setSavedAt(false);
  };

  const eventToWorld = (e: React.PointerEvent): Point => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const w = screenToWorld(e.clientX, e.clientY, rect, view.width, view.length);
    return { x: clamp(snap(w.x, GRID), 0, view.width), y: clamp(snap(w.y, GRID), 0, view.length) };
  };

  const resetRectangle = () => {
    const r = defaultRoomOutline(roomW, roomL);
    setPoints(r.points);
    setSelection(null);
    markDirty();
  };
  const clearOutline = () => {
    setPoints([]);
    setSelection(null);
    markDirty();
  };
  const addVertexAt = (p: Point) => {
    setPoints((prev) => [...prev, { x: round(p.x), y: round(p.y) }]);
    markDirty();
  };
  const deleteVertex = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
    setSelection(null);
    markDirty();
  };

  const addRectObstacle = (shape: "rect" | "circle") => {
    const size = shape === "circle" ? 0.6 : 1;
    const o: Obstacle = {
      id: genId("ob"),
      label: shape === "circle" ? `Pillar ${obstacles.length + 1}` : `Obstacle ${obstacles.length + 1}`,
      shape,
      x: round(clamp(view.width / 2 - size / 2, 0, view.width - size)),
      y: round(clamp(view.length / 2 - size / 2, 0, view.length - size)),
      width: size,
      length: size,
      rotation: 0,
    };
    setObstacles((prev) => [...prev, o]);
    setSelection({ kind: "obstacle", id: o.id });
    markDirty();
  };
  const startPolygonObstacle = () => {
    setSelection(null);
    setDrawingPoly([]);
  };
  const finishPolygonObstacle = () => {
    if (!drawingPoly || drawingPoly.length < 3) return;
    const b = polygonBounds(drawingPoly);
    const o: Obstacle = {
      id: genId("ob"),
      label: `Obstacle ${obstacles.length + 1}`,
      shape: "polygon",
      points: drawingPoly.map((p) => ({ x: round(p.x), y: round(p.y) })),
      x: round(b.minX),
      y: round(b.minY),
      width: round(b.width),
      length: round(b.length),
      rotation: 0,
    };
    setObstacles((prev) => [...prev, o]);
    setDrawingPoly(null);
    setSelection({ kind: "obstacle", id: o.id });
    markDirty();
  };
  const cancelPolygonObstacle = () => setDrawingPoly(null);

  const updateObstacle = (id: string, patch: Partial<Obstacle>) => {
    setObstacles((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    markDirty();
  };
  const moveObstacle = (id: string, nx: number, ny: number) => {
    setObstacles((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.shape === "polygon" && o.points) {
          const dx = nx - o.x;
          const dy = ny - o.y;
          return { ...o, x: round(nx), y: round(ny), points: o.points.map((p) => ({ x: round(p.x + dx), y: round(p.y + dy) })) };
        }
        return { ...o, x: round(nx), y: round(ny) };
      })
    );
    markDirty();
  };
  const moveObstacleVertex = (id: string, index: number, p: Point) => {
    setObstacles((prev) =>
      prev.map((o) => {
        if (o.id !== id || !o.points) return o;
        const pts = o.points.map((pt, i) => (i === index ? { x: round(p.x), y: round(p.y) } : pt));
        const b = polygonBounds(pts);
        return { ...o, points: pts, x: round(b.minX), y: round(b.minY), width: round(b.width), length: round(b.length) };
      })
    );
    markDirty();
  };
  const deleteObstacle = (id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    setSelection(null);
    markDirty();
  };

  const addFixture = (type: FixtureType) => {
    const meta = FIXTURE_META[type];
    const f: Fixture = {
      id: genId("fx"),
      type,
      shape: "rect",
      label: meta.label,
      x: round(clamp(view.width / 2 - meta.w / 2, 0, view.width - meta.w)),
      y: round(clamp(view.length / 2 - meta.l / 2, 0, view.length - meta.l)),
      width: meta.w,
      length: meta.l,
      facing: meta.facing,
      rotation: 0,
    };
    setFixtures((prev) => [...prev, f]);
    setSelection({ kind: "fixture", id: f.id });
    markDirty();
  };
  const updateFixture = (id: string, patch: Partial<Fixture>) => {
    setFixtures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    markDirty();
  };
  const convertFixtureShape = (id: string, shape: Shape) => {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        if (shape === "circle") {
          const d = Math.min(f.width, f.length) || f.width;
          return { ...f, shape, width: d, length: d, points: undefined };
        }
        if (shape === "polygon") {
          const pts = f.points ?? rectCorners(f.x, f.y, f.width, f.length);
          const b = polygonBounds(pts);
          return { ...f, shape, points: pts, rotation: 0, x: round(b.minX), y: round(b.minY), width: round(b.width), length: round(b.length) };
        }
        return { ...f, shape: "rect", points: undefined };
      })
    );
    markDirty();
  };
  const moveFixture = (id: string, nx: number, ny: number) => {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        if (shapeOf(f.shape) === "polygon" && f.points) {
          const dx = nx - f.x;
          const dy = ny - f.y;
          return { ...f, x: round(nx), y: round(ny), points: f.points.map((p) => ({ x: round(p.x + dx), y: round(p.y + dy) })) };
        }
        return { ...f, x: round(nx), y: round(ny) };
      })
    );
    markDirty();
  };
  const moveFixtureVertex = (id: string, index: number, p: Point) => {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.points) return f;
        const pts = f.points.map((pt, i) => (i === index ? { x: round(p.x), y: round(p.y) } : pt));
        const b = polygonBounds(pts);
        return { ...f, points: pts, x: round(b.minX), y: round(b.minY), width: round(b.width), length: round(b.length) };
      })
    );
    markDirty();
  };
  const deleteFixture = (id: string) => {
    setFixtures((prev) => prev.filter((f) => f.id !== id));
    setSelection(null);
    markDirty();
  };

  const addFeature = (kind: FeatureKind) => {
    const meta = FEATURE_META[kind];
    const f: Feature = {
      id: genId("ft"),
      kind,
      label: meta.label,
      x: round(clamp(view.width / 2 - meta.w / 2, 0, view.width - meta.w)),
      y: round(clamp(view.length / 2 - meta.l / 2, 0, view.length - meta.l)),
      width: meta.w,
      length: meta.l,
      facing: meta.facing,
      rotation: 0,
      ...(kind === "bench" ? { seats: meta.seats } : {}),
    };
    setFeatures((prev) => [...prev, f]);
    setSelection({ kind: "feature", id: f.id });
    markDirty();
  };
  const updateFeature = (id: string, patch: Partial<Feature>) => {
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    markDirty();
  };
  const deleteFeature = (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    setSelection(null);
    markDirty();
  };

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (mode === "outline") {
      addVertexAt(eventToWorld(e));
    } else if (mode === "obstacles" && drawingPoly) {
      setDrawingPoly((prev) => [...(prev ?? []), eventToWorld(e)]);
      markDirty();
    } else {
      setSelection(null);
    }
  };

  const beginDrag = (e: React.PointerEvent, drag: DragState, sel: Selection) => {
    e.stopPropagation();
    dragRef.current = drag;
    setSelection(sel);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const w = eventToWorld(e);
    if (drag.kind === "vertex") {
      setPoints((prev) => prev.map((p, i) => (i === drag.index ? { x: round(w.x), y: round(w.y) } : p)));
      markDirty();
    } else if (drag.kind === "obstacle") {
      moveObstacle(drag.id, round(clamp(w.x - drag.grabDX, 0, view.width)), round(clamp(w.y - drag.grabDY, 0, view.length)));
    } else if (drag.kind === "obstacleVertex") {
      moveObstacleVertex(drag.id, drag.index, w);
    } else if (drag.kind === "fixture") {
      moveFixture(drag.id, round(clamp(w.x - drag.grabDX, 0, view.width)), round(clamp(w.y - drag.grabDY, 0, view.length)));
    } else if (drag.kind === "fixtureVertex") {
      moveFixtureVertex(drag.id, drag.index, w);
    } else if (drag.kind === "feature") {
      updateFeature(drag.id, { x: round(clamp(w.x - drag.grabDX, 0, view.width)), y: round(clamp(w.y - drag.grabDY, 0, view.length)) });
    }
  };

  const onSvgPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
      }
    }
  };

  const handleSave = () => {
    setFormError(null);
    if (!companyId) {
      setFormError("No company record found to save against.");
      return;
    }
    const geometry: VenueGeometry = {
      room_outline:
        points.length >= 3
          ? { points: points.map((p) => ({ x: round(p.x), y: round(p.y) })), width: round(roomW), length: round(roomL) }
          : null,
      obstacles,
      fixtures,
      features,
    };
    startTransition(async () => {
      const result = await saveVenueLayoutAction(companyId, geometry);
      if (result?.error) setFormError(result.error);
      else {
        setDirty(false);
        setSavedAt(true);
      }
    });
  };

  const fontSize = clamp(Math.min(view.width, view.length) * 0.04, 0.18, 0.5);
  const handleR = clamp(Math.min(view.width, view.length) * 0.018, 0.08, 0.22);
  const gridLines = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = 1; x < view.width; x += 1) xs.push(x);
    for (let y = 1; y < view.length; y += 1) ys.push(y);
    return { xs, ys };
  }, [view.width, view.length]);

  const outlinePath = points.map((p) => `${p.x},${p.y}`).join(" ");
  const roomArea = points.length >= 3 ? polygonArea(points) : 0;

  const selectedObstacle = selection?.kind === "obstacle" ? obstacles.find((o) => o.id === selection.id) ?? null : null;
  const selectedFixture =
    selection?.kind === "fixture" || selection?.kind === "fixtureVertex"
      ? fixtures.find((f) => f.id === selection.id) ?? null
      : null;
  const selectedFeature = selection?.kind === "feature" ? features.find((f) => f.id === selection.id) ?? null : null;

  const benchSeatTotal = features.filter((f) => f.kind === "bench").reduce((sum, f) => sum + (f.seats ?? 0), 0);

  return (
    <div className="max-w-5xl space-y-4 px-2 py-2 sm:px-4 sm:py-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-base tracking-tight text-[#1F1F1A] uppercase">Venue Layout</h2>
          <p className="mt-0.5 text-[11px] font-bold text-[#5F624F]">
            {companyName ? `${companyName} — ` : ""}draw the room, drop obstacles, place fixtures, doors &amp; seating.
            Reused by every event&apos;s floor-plan calculator.
          </p>
        </div>
        {dirty ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-black text-[10px] tracking-widest text-amber-700 uppercase">
            <AlertCircle className="h-3 w-3" /> Unsaved
          </span>
        ) : savedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 font-black text-[10px] tracking-widest text-green-700 uppercase">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModeButton active={mode === "outline"} onClick={() => { setMode("outline"); setSelection(null); setDrawingPoly(null); }} icon={<Pentagon className="h-4 w-4" />} label="Room" />
        <ModeButton active={mode === "obstacles"} onClick={() => { setMode("obstacles"); setSelection(null); }} icon={<Ban className="h-4 w-4" />} label="Obstacles" />
        <ModeButton active={mode === "fixtures"} onClick={() => { setMode("fixtures"); setSelection(null); setDrawingPoly(null); }} icon={<Sofa className="h-4 w-4" />} label="Fixtures" />
        <ModeButton active={mode === "features"} onClick={() => { setMode("features"); setSelection(null); setDrawingPoly(null); }} icon={<DoorOpen className="h-4 w-4" />} label="Doors & Seating" />
      </div>

      <div className="rounded-2xl border border-[#E6DFC8] bg-white p-3">
        {mode === "outline" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <DimInput id="room-w" label="Room width (m)" value={roomW} onChange={(v) => { setRoomW(v); markDirty(); }} />
              <DimInput id="room-l" label="Room length (m)" value={roomL} onChange={(v) => { setRoomL(v); markDirty(); }} />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#5F624F]">
              <Info className="h-3 w-3 shrink-0" />
              Tap the canvas to add corner points (clockwise). Drag a point to move it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={resetRectangle} className="h-9 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5C4033] uppercase hover:bg-[#F7F4EA]">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to rectangle
              </Button>
              <Button type="button" onClick={clearOutline} disabled={points.length === 0} className="h-9 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5F624F] uppercase hover:bg-[#F7F4EA] disabled:opacity-40">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        )}

        {mode === "obstacles" && (
          <div className="space-y-3">
            {drawingPoly ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-[11px] tracking-wide text-[#5C4033] uppercase">
                  Drawing polygon — tap to add points ({drawingPoly.length})
                </span>
                <Button type="button" onClick={finishPolygonObstacle} disabled={drawingPoly.length < 3} className="h-9 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85 disabled:opacity-40">
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Finish
                </Button>
                <Button type="button" onClick={cancelPolygonObstacle} className="h-9 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => addRectObstacle("rect")} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                  <SquareIcon className="mr-1 h-3.5 w-3.5" /> Rectangle
                </Button>
                <Button type="button" onClick={() => addRectObstacle("circle")} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                  <CircleIcon className="mr-1 h-3.5 w-3.5" /> Circle
                </Button>
                <Button type="button" onClick={startPolygonObstacle} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                  <Spline className="mr-1 h-3.5 w-3.5" /> Polygon
                </Button>
              </div>
            )}
            {selectedObstacle && !drawingPoly && (
              <ObstacleInspector obstacle={selectedObstacle} onChange={(patch) => updateObstacle(selectedObstacle.id, patch)} onDelete={() => deleteObstacle(selectedObstacle.id)} />
            )}
          </div>
        )}

        {mode === "fixtures" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {FIXTURE_ORDER.map((t) => (
                <Button key={t} type="button" onClick={() => addFixture(t)} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                  <Plus className="mr-1 h-3.5 w-3.5" /> {FIXTURE_META[t].label}
                </Button>
              ))}
            </div>
            {selectedFixture && (
              <FixtureInspector
                fixture={selectedFixture}
                onChange={(patch) => updateFixture(selectedFixture.id, patch)}
                onShape={(shape) => convertFixtureShape(selectedFixture.id, shape)}
                onDelete={() => deleteFixture(selectedFixture.id)}
              />
            )}
          </div>
        )}

        {mode === "features" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => addFeature("door")} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                <DoorOpen className="mr-1 h-3.5 w-3.5" /> Door
              </Button>
              <Button type="button" onClick={() => addFeature("window")} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                <RectangleHorizontal className="mr-1 h-3.5 w-3.5" /> Window
              </Button>
              <Button type="button" onClick={() => addFeature("bench")} className="h-10 rounded-xl bg-[#1B4332] px-3 font-black text-[10px] tracking-widest text-white uppercase hover:bg-[#1B4332]/85">
                <Armchair className="mr-1 h-3.5 w-3.5" /> Bench
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#5F624F]">
              <Info className="h-3 w-3 shrink-0" />
              Doors get a keep-clear zone (their facing direction). Benches add {benchSeatTotal} seat{benchSeatTotal !== 1 ? "s" : ""} to the venue.
            </p>
            {selectedFeature && (
              <FeatureInspector feature={selectedFeature} onChange={(patch) => updateFeature(selectedFeature.id, patch)} onDelete={() => deleteFeature(selectedFeature.id)} />
            )}
          </div>
        )}
      </div>

      <div
        className="aspect-(--venue-ar) w-full overflow-hidden rounded-2xl border-2 border-[#E6DFC8] bg-[#FFFDF7]"
        style={{ "--venue-ar": `${view.width} / ${view.length}` } as React.CSSProperties}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${view.width} ${view.length}`}
          className="h-full w-full touch-none select-none"
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
        >
          <g stroke="#E6DFC8" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6}>
            {gridLines.xs.map((x) => (
              <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={view.length} />
            ))}
            {gridLines.ys.map((y) => (
              <line key={`gy${y}`} x1={0} y1={y} x2={view.width} y2={y} />
            ))}
          </g>

          {points.length >= 2 && (
            <polygon
              points={outlinePath}
              fill={points.length >= 3 ? "#5C4033" : "none"}
              fillOpacity={0.05}
              stroke="#5C4033"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {obstacles.map((o) => {
            const isSel = selection?.kind === "obstacle" && selection.id === o.id;
            const stroke = isSel ? "#B45309" : "#DC2626";
            const common = { fill: "#DC2626", fillOpacity: 0.18, stroke, strokeWidth: isSel ? 3 : 2, strokeDasharray: "4 2", vectorEffect: "non-scaling-stroke" as const };
            const draggable = mode === "obstacles" && !drawingPoly;
            const cx = o.x + o.width / 2;
            const cy = o.y + o.length / 2;
            const transform = rotTransform(rotOf(o.rotation), cx, cy, o.shape);
            return (
              <g key={o.id} onPointerDown={(e) => draggable && beginDrag(e, { kind: "obstacle", id: o.id, grabDX: eventToWorld(e).x - o.x, grabDY: eventToWorld(e).y - o.y }, { kind: "obstacle", id: o.id })} className={draggable ? "cursor-move" : ""}>
                <g transform={transform}>
                  {o.shape === "circle" ? (
                    <ellipse cx={cx} cy={cy} rx={o.width / 2} ry={o.length / 2} {...common} />
                  ) : o.shape === "polygon" && o.points ? (
                    <polygon points={o.points.map((p) => `${p.x},${p.y}`).join(" ")} {...common} strokeLinejoin="round" />
                  ) : (
                    <rect x={o.x} y={o.y} width={o.width} height={o.length} rx={0.05} {...common} />
                  )}
                  <text x={cx} y={cy} fontSize={fontSize} fontWeight={700} fill="#991B1B" textAnchor="middle" dominantBaseline="middle">
                    {o.label}
                  </text>
                </g>
              </g>
            );
          })}

          {mode === "obstacles" && !drawingPoly && selectedObstacle?.shape === "polygon" && selectedObstacle.points &&
            selectedObstacle.points.map((p, i) => (
              <circle key={`ov${i}`} cx={p.x} cy={p.y} r={handleR} fill={selection?.kind === "obstacleVertex" && selection.index === i ? "#B45309" : "#FFFFFF"} stroke="#DC2626" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "obstacleVertex", id: selectedObstacle.id, index: i }, { kind: "obstacleVertex", id: selectedObstacle.id, index: i })} />
            ))}

          {drawingPoly && drawingPoly.length > 0 && (
            <g>
              <polyline points={drawingPoly.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#B45309" strokeWidth={2} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
              {drawingPoly.map((p, i) => (
                <circle key={`dp${i}`} cx={p.x} cy={p.y} r={handleR} fill="#FDCC4B" stroke="#B45309" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          )}

          {fixtures.map((f) => {
            const isSel = (selection?.kind === "fixture" || selection?.kind === "fixtureVertex") && selection.id === f.id;
            const meta = FIXTURE_META[f.type];
            const shape = shapeOf(f.shape);
            const cx = f.x + f.width / 2;
            const cy = f.y + f.length / 2;
            const transform = rotTransform(rotOf(f.rotation), cx, cy, shape);
            const arrow = f.facing != null ? facingToVector(f.facing) : null;
            const arrowLen = Math.min(f.width, f.length) * 0.7 + 0.3;
            const draggable = mode === "fixtures";
            const common = { fill: meta.fill, fillOpacity: 0.85, stroke: isSel ? "#B45309" : meta.stroke, strokeWidth: isSel ? 3 : 1.5, vectorEffect: "non-scaling-stroke" as const };
            return (
              <g key={f.id} onPointerDown={(e) => draggable && beginDrag(e, { kind: "fixture", id: f.id, grabDX: eventToWorld(e).x - f.x, grabDY: eventToWorld(e).y - f.y }, { kind: "fixture", id: f.id })} className={draggable ? "cursor-move" : ""}>
                <g transform={transform}>
                  {shape === "circle" ? (
                    <ellipse cx={cx} cy={cy} rx={f.width / 2} ry={f.length / 2} {...common} />
                  ) : shape === "polygon" && f.points ? (
                    <polygon points={f.points.map((p) => `${p.x},${p.y}`).join(" ")} {...common} strokeLinejoin="round" />
                  ) : (
                    <rect x={f.x} y={f.y} width={f.width} height={f.length} rx={0.05} {...common} />
                  )}
                  <text x={cx} y={cy} fontSize={fontSize} fontWeight={800} fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle">
                    {f.label}
                  </text>
                </g>
                {arrow && <line x1={cx} y1={cy} x2={cx + arrow.x * arrowLen} y2={cy + arrow.y * arrowLen} stroke="#FDCC4B" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                {arrow && <circle cx={cx + arrow.x * arrowLen} cy={cy + arrow.y * arrowLen} r={handleR * 0.7} fill="#FDCC4B" />}
              </g>
            );
          })}

          {mode === "fixtures" && selectedFixture && shapeOf(selectedFixture.shape) === "polygon" && selectedFixture.points &&
            selectedFixture.points.map((p, i) => (
              <circle key={`fv${i}`} cx={p.x} cy={p.y} r={handleR} fill={selection?.kind === "fixtureVertex" && selection.index === i ? "#B45309" : "#FFFFFF"} stroke={FIXTURE_META[selectedFixture.type].stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "fixtureVertex", id: selectedFixture.id, index: i }, { kind: "fixtureVertex", id: selectedFixture.id, index: i })} />
            ))}

          {features.map((f) => {
            const isSel = selection?.kind === "feature" && selection.id === f.id;
            const meta = FEATURE_META[f.kind];
            const cx = f.x + f.width / 2;
            const cy = f.y + f.length / 2;
            const draggable = mode === "features";
            const doorWidth = Math.max(f.width, f.length);
            const clearance = f.kind === "door" && f.facing != null ? doorClearancePolygon({ x: cx, y: cy }, f.facing, doorWidth, doorWidth) : null;
            const seatPts = f.kind === "bench" ? benchSeatPositions(f.x, f.y, f.width, f.length, f.facing, f.seats ?? 0) : [];
            const arrow = f.facing != null && f.kind !== "window" ? facingToVector(f.facing) : null;
            const arrowLen = Math.min(f.width, f.length) * 0.6 + 0.25;
            const transform = rotTransform(rotOf(f.rotation), cx, cy, "rect");
            return (
              <g key={f.id} onPointerDown={(e) => draggable && beginDrag(e, { kind: "feature", id: f.id, grabDX: eventToWorld(e).x - f.x, grabDY: eventToWorld(e).y - f.y }, { kind: "feature", id: f.id })} className={draggable ? "cursor-move" : ""}>
                {clearance && <polygon points={clearance.map((p) => `${p.x},${p.y}`).join(" ")} fill={meta.fill} fillOpacity={0.12} stroke={meta.stroke} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
                <g transform={transform}>
                  <rect x={f.x} y={f.y} width={f.width} height={f.length} fill={meta.fill} fillOpacity={f.kind === "window" ? 0.6 : 0.9} stroke={isSel ? "#B45309" : meta.stroke} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" rx={0.03} />
                  {seatPts.map((p, i) => (
                    <circle key={`bs${i}`} cx={p.x} cy={p.y} r={handleR * 0.8} fill="#FFFDF7" stroke={meta.stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  ))}
                  <text x={cx} y={f.y - fontSize * 0.3} fontSize={fontSize * 0.85} fontWeight={800} fill="#5C4033" textAnchor="middle">
                    {f.kind === "bench" ? `${f.label} (${f.seats ?? 0})` : f.label}
                  </text>
                </g>
                {arrow && <line x1={cx} y1={cy} x2={cx + arrow.x * arrowLen} y2={cy + arrow.y * arrowLen} stroke="#1F1F1A" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              </g>
            );
          })}

          {mode === "outline" &&
            points.map((p, i) => {
              const isSel = selection?.kind === "vertex" && selection.index === i;
              return (
                <circle key={`v${i}`} cx={p.x} cy={p.y} r={handleR} fill={isSel ? "#B45309" : "#FFFFFF"} stroke="#5C4033" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "vertex", index: i }, { kind: "vertex", index: i })} />
              );
            })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-[#5F624F]">
        <span className="tabular-nums">{points.length} outline point{points.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">Area {round(roomArea, 1)} m²</span>
        <span className="tabular-nums">{obstacles.length} obstacle{obstacles.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">{fixtures.length} fixture{fixtures.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "door").length} door(s)</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "window").length} window(s)</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "bench").length} bench(es) · {benchSeatTotal} seat{benchSeatTotal !== 1 ? "s" : ""}</span>
      </div>

      {mode === "outline" && selection?.kind === "vertex" && points[selection.index] && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E6DFC8] bg-white p-3">
          <DimInput id="vx" label="Point X (m)" value={points[selection.index].x} onChange={(v) => setPoints((prev) => prev.map((p, i) => (i === selection.index ? { ...p, x: v } : p)))} />
          <DimInput id="vy" label="Point Y (m)" value={points[selection.index].y} onChange={(v) => setPoints((prev) => prev.map((p, i) => (i === selection.index ? { ...p, y: v } : p)))} />
          <Button type="button" onClick={() => deleteVertex(selection.index)} disabled={points.length <= 3} className="h-11 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 font-black text-[10px] tracking-wide text-red-600 uppercase disabled:opacity-40">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete point
          </Button>
        </div>
      )}

      {formError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm font-bold text-red-700">{formError}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isPending || !companyId} className="h-12 rounded-xl bg-[#1B4332] px-6 font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#1B4332]/85 active:scale-95 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save layout</>}
        </Button>
      </div>
    </div>
  );
}


function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border-2 px-4 font-black text-[10px] tracking-wide uppercase transition-all",
        active ? "border-[#5C4033] bg-[#5C4033] text-white shadow-sm" : "border-[#E6DFC8] bg-white text-[#5F624F] hover:border-[#5C4033]/40"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DimInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={0.1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? round(Math.max(0, n)) : 0);
        }}
        className="h-11 w-28 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold tabular-nums focus:border-[#5C4033]"
      />
    </div>
  );
}

function ShapeToggle({ value, onChange }: { value: Shape; onChange: (s: Shape) => void }) {
  const opts: { s: Shape; icon: React.ReactNode; label: string }[] = [
    { s: "rect", icon: <SquareIcon className="h-3.5 w-3.5" />, label: "Rect" },
    { s: "circle", icon: <CircleIcon className="h-3.5 w-3.5" />, label: "Circle" },
    { s: "polygon", icon: <Spline className="h-3.5 w-3.5" />, label: "Polygon" },
  ];
  return (
    <div className="space-y-1.5">
      <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Shape</Label>
      <div className="flex gap-1.5">
        {opts.map((o) => (
          <button
            key={o.s}
            type="button"
            onClick={() => onChange(o.s)}
            aria-label={`${o.label} shape`}
            aria-pressed={value === o.s}
            className={cn(
              "flex h-11 items-center gap-1 rounded-xl border-2 px-2.5 font-black text-[10px] tracking-wide uppercase transition-all",
              value === o.s ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-white text-[#5F624F] hover:border-[#5C4033]/40"
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RotationField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.round(((v % 360) + 360) % 360));
  return (
    <div className="space-y-1.5">
      <Label htmlFor="rot-input" className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">
        Rotation (°)
      </Label>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => set(value - 15)} aria-label="Rotate 15 degrees left" title="Rotate left" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#E6DFC8] bg-white text-[#5C4033] hover:bg-[#F7F4EA]">
          <RotateCcw className="h-4 w-4" />
        </button>
        <Input
          id="rot-input"
          type="number"
          min={0}
          max={359}
          step={5}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            set(Number.isFinite(n) ? n : 0);
          }}
          className="h-11 w-full rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold tabular-nums focus:border-[#5C4033]"
        />
        <button type="button" onClick={() => set(value + 15)} aria-label="Rotate 15 degrees right" title="Rotate right" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#E6DFC8] bg-white text-[#5C4033] hover:bg-[#F7F4EA]">
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ObstacleInspector({ obstacle, onChange, onDelete }: { obstacle: Obstacle; onChange: (patch: Partial<Obstacle>) => void; onDelete: () => void }) {
  const isCircle = obstacle.shape === "circle";
  const isPolygon = obstacle.shape === "polygon";
  return (
    <div className="space-y-3 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ob-label" className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Label</Label>
          <Input id="ob-label" value={obstacle.label} onChange={(e) => onChange({ label: e.target.value })} className="h-11 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold focus:border-[#5C4033]" />
        </div>
        <span className="mb-2.5 self-end rounded-lg border border-[#E6DFC8] bg-white px-2 py-1 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">{obstacle.shape}</span>
      </div>
      {isPolygon ? (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#5F624F]">
          <Info className="h-3 w-3 shrink-0" />
          Drag the red points on the canvas to reshape. Bounds {round(obstacle.width, 1)} × {round(obstacle.length, 1)} m.
        </p>
      ) : isCircle ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumField id="ob-x" label="X (m)" value={obstacle.x} onChange={(v) => onChange({ x: v })} />
          <NumField id="ob-y" label="Y (m)" value={obstacle.y} onChange={(v) => onChange({ y: v })} />
          <NumField id="ob-d" label="Diameter (m)" value={obstacle.width} min={MIN_SIZE} onChange={(v) => onChange({ width: v, length: v })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumField id="ob-x" label="X (m)" value={obstacle.x} onChange={(v) => onChange({ x: v })} />
          <NumField id="ob-y" label="Y (m)" value={obstacle.y} onChange={(v) => onChange({ y: v })} />
          <NumField id="ob-w" label="Width (m)" value={obstacle.width} min={MIN_SIZE} onChange={(v) => onChange({ width: v })} />
          <NumField id="ob-l" label="Length (m)" value={obstacle.length} min={MIN_SIZE} onChange={(v) => onChange({ length: v })} />
        </div>
      )}
      {!isPolygon && (
        <div className="sm:max-w-xs">
          <RotationField value={rotOf(obstacle.rotation)} onChange={(v) => onChange({ rotation: v })} />
        </div>
      )}
      <Button type="button" onClick={onDelete} className="h-10 rounded-xl border-2 border-red-200 bg-white px-3 font-black text-[10px] tracking-wide text-red-600 uppercase hover:bg-red-50">
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete obstacle
      </Button>
    </div>
  );
}

function FixtureInspector({ fixture, onChange, onShape, onDelete }: { fixture: Fixture; onChange: (patch: Partial<Fixture>) => void; onShape: (s: Shape) => void; onDelete: () => void }) {
  const showFacing = fixture.facing != null;
  const shape = shapeOf(fixture.shape);
  return (
    <div className="space-y-3 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fx-type" className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Type</Label>
          <select
            id="fx-type"
            title="Fixture type"
            aria-label="Fixture type"
            value={fixture.type}
            onChange={(e) => {
              const type = e.target.value as FixtureType;
              const facing = FIXTURE_META[type].facing;
              onChange({ type, facing: facing == null ? null : fixture.facing ?? facing });
            }}
            className="h-11 w-full rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold text-[#1F1F1A] outline-none focus:border-[#5C4033]"
          >
            {FIXTURE_ORDER.map((t) => (
              <option key={t} value={t}>{FIXTURE_META[t].label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fx-label" className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Label</Label>
          <Input id="fx-label" value={fixture.label} onChange={(e) => onChange({ label: e.target.value })} className="h-11 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold focus:border-[#5C4033]" />
        </div>
      </div>
      <ShapeToggle value={shape} onChange={onShape} />
      {shape === "polygon" ? (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#5F624F]">
          <Info className="h-3 w-3 shrink-0" />
          Drag the points on the canvas to reshape. Bounds {round(fixture.width, 1)} × {round(fixture.length, 1)} m.
        </p>
      ) : shape === "circle" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumField id="fx-x" label="X (m)" value={fixture.x} onChange={(v) => onChange({ x: v })} />
          <NumField id="fx-y" label="Y (m)" value={fixture.y} onChange={(v) => onChange({ y: v })} />
          <NumField id="fx-d" label="Diameter (m)" value={fixture.width} min={MIN_SIZE} onChange={(v) => onChange({ width: v, length: v })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumField id="fx-x" label="X (m)" value={fixture.x} onChange={(v) => onChange({ x: v })} />
          <NumField id="fx-y" label="Y (m)" value={fixture.y} onChange={(v) => onChange({ y: v })} />
          <NumField id="fx-w" label="Width (m)" value={fixture.width} min={MIN_SIZE} onChange={(v) => onChange({ width: v })} />
          <NumField id="fx-l" label="Length (m)" value={fixture.length} min={MIN_SIZE} onChange={(v) => onChange({ length: v })} />
        </div>
      )}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
        {shape !== "polygon" && <RotationField value={rotOf(fixture.rotation)} onChange={(v) => onChange({ rotation: v })} />}
        {showFacing && <NumField id="fx-facing" label="Facing (°)" value={fixture.facing ?? 0} min={0} max={359} step={5} onChange={(v) => onChange({ facing: Math.round(((v % 360) + 360) % 360) })} />}
      </div>
      {showFacing && <p className="text-[10px] font-bold text-[#5F624F]">Facing: 0° up · 90° right · 180° down · 270° left (sightline direction)</p>}
      <Button type="button" onClick={onDelete} className="h-10 rounded-xl border-2 border-red-200 bg-white px-3 font-black text-[10px] tracking-wide text-red-600 uppercase hover:bg-red-50">
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete fixture
      </Button>
    </div>
  );
}

function FeatureInspector({ feature, onChange, onDelete }: { feature: Feature; onChange: (patch: Partial<Feature>) => void; onDelete: () => void }) {
  const showFacing = feature.kind !== "window";
  const isBench = feature.kind === "bench";
  return (
    <div className="space-y-3 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ft-label" className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">Label</Label>
          <Input id="ft-label" value={feature.label} onChange={(e) => onChange({ label: e.target.value })} className="h-11 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold focus:border-[#5C4033]" />
        </div>
        <span className="mb-2.5 self-end rounded-lg border border-[#E6DFC8] bg-white px-2 py-1 font-black text-[10px] tracking-widest text-[#5F624F] uppercase">{feature.kind}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumField id="ft-x" label="X (m)" value={feature.x} onChange={(v) => onChange({ x: v })} />
        <NumField id="ft-y" label="Y (m)" value={feature.y} onChange={(v) => onChange({ y: v })} />
        <NumField id="ft-w" label="Width (m)" value={feature.width} min={MIN_SIZE} onChange={(v) => onChange({ width: v })} />
        <NumField id="ft-l" label="Length (m)" value={feature.length} min={MIN_SIZE} onChange={(v) => onChange({ length: v })} />
      </div>
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
        <RotationField value={rotOf(feature.rotation)} onChange={(v) => onChange({ rotation: v })} />
        {showFacing && <NumField id="ft-facing" label="Facing (°)" value={feature.facing ?? 0} min={0} max={359} step={5} onChange={(v) => onChange({ facing: Math.round(((v % 360) + 360) % 360) })} />}
        {isBench && <NumField id="ft-seats" label="Seats" value={feature.seats ?? 0} min={0} step={1} onChange={(v) => onChange({ seats: Math.round(v) })} />}
      </div>
      {showFacing && <p className="text-[10px] font-bold text-[#5F624F]">Facing: 0° up · 90° right · 180° down · 270° left</p>}
      <Button type="button" onClick={onDelete} className="h-10 rounded-xl border-2 border-red-200 bg-white px-3 font-black text-[10px] tracking-wide text-red-600 uppercase hover:bg-red-50">
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete {feature.kind}
      </Button>
    </div>
  );
}

function NumField({ id, label, value, min = 0, max, step = 0.1, onChange }: { id: string; label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="ml-1 font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{label}</Label>
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
          let clamped = Math.max(min, n);
          if (max != null) clamped = Math.min(max, clamped);
          onChange(round(clamped));
        }}
        className="h-11 w-full rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold tabular-nums focus:border-[#5C4033]"
      />
    </div>
  );
}
