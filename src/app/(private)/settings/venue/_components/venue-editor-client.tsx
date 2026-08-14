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
import { StatusPill, ErrorBox } from "@/components/admin";
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
  rotatedRectCorners,
  rotateAbout,
  resizeRotatedBox,
  resizePolygon,
  rotatePolygonAbout,
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
import { layoutLabels, type LabelInput } from "@/lib/floor-plan/labels";
import {
  BLOCKING_FIXTURE_TYPES,
  FOCAL_FIXTURE_TYPES,
  DEFAULT_FIXTURE_HEIGHT,
  DEFAULT_VIEW_HEIGHT,
  DEFAULT_FEATURE_HEIGHT,
} from "@/lib/floor-plan/types";
import { saveVenueLayoutAction } from "../actions";

type Mode = "outline" | "obstacles" | "fixtures" | "features";
type Shape = "rect" | "circle" | "polygon";
const GRID = 0.1; // snap step (m)
const MIN_SIZE = 0.2; // smallest element dimension (m)

// Adding an element only changes local state; only "Save layout" writes the
// record, so it is the one solid olive button on the page.
const FIELD_LABEL = "ml-1 text-[11px] font-semibold tracking-wide text-admin-muted";
const FIELD_BOX =
  "h-11 w-full rounded-xl border border-admin-line bg-admin-card px-3 text-sm font-semibold text-admin-ink focus:border-admin-primary";
const HINT = "flex items-center gap-1.5 text-[11px] font-medium text-admin-muted";
const BTN_ADD =
  "h-10 rounded-xl border border-admin-primary bg-admin-card px-3 text-[13px] font-semibold text-admin-primary hover:bg-admin-primary-soft disabled:opacity-40";
const BTN_NEUTRAL =
  "h-10 rounded-xl border border-admin-line bg-admin-card px-3 text-[13px] font-semibold text-admin-muted hover:bg-admin-surface disabled:opacity-40";
const BTN_DANGER =
  "h-10 rounded-xl border border-admin-error/30 bg-admin-card px-3 text-[13px] font-semibold text-admin-error hover:bg-admin-error-bg disabled:opacity-40";
const INSPECTOR = "space-y-3 rounded-2xl border border-admin-line bg-admin-surface p-3";
const KIND_PILL =
  "mb-2.5 self-end rounded-lg border border-admin-line bg-admin-card px-2 py-1 text-[11px] font-semibold text-admin-muted capitalize";

const FIXTURE_META: Record<
  FixtureType,
  { label: string; w: number; l: number; facing: number | null; fill: string; stroke: string }
> = {
  stage: { label: "Stage", w: 4, l: 1.5, facing: 180, fill: "#4338CA", stroke: "#3730A3" },
  bar: { label: "Bar", w: 4, l: 0.8, facing: null, fill: "#34451F", stroke: "#42301F" },
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
  bench: { label: "Bench", w: 1.6, l: 0.45, facing: 0, seats: 3, fill: "#8B6F47", stroke: "#34451F" },
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

type EntityKind = "obstacle" | "fixture" | "feature";

type BoxPatch = { x?: number; y?: number; width?: number; length?: number; rotation?: number };

type DragState =
  | { kind: "vertex"; index: number }
  | { kind: "obstacle"; id: string; grabDX: number; grabDY: number }
  | { kind: "obstacleVertex"; id: string; index: number }
  | { kind: "fixture"; id: string; grabDX: number; grabDY: number }
  | { kind: "fixtureVertex"; id: string; index: number }
  | { kind: "feature"; id: string; grabDX: number; grabDY: number }
  | {
      kind: "resize";
      entity: EntityKind;
      id: string;
      dx: number;
      dy: number;
      anchor: Point;
      rotation: number;
      width: number;
      length: number;
      circular: boolean;
    }
  | { kind: "rotate"; entity: EntityKind; id: string; cx: number; cy: number }
  | {
      kind: "resizePoly";
      entity: EntityKind;
      id: string;
      dx: number;
      dy: number;
      anchor: Point;
      width: number;
      length: number;
      points: Point[];
    }
  | {
      kind: "rotatePoly";
      entity: EntityKind;
      id: string;
      centre: Point;
      startBearing: number;
      points: Point[];
    }
  | null;

type EditableBox = {
  entity: EntityKind;
  id: string;
  x: number;
  y: number;
  width: number;
  length: number;
  rotation: number;
  circular: boolean;
  stroke: string;
  points?: Point[]; // present only for polygons, whose points are the real shape
};

function bearingTo(centre: Point, p: Point): number {
  return (Math.atan2(p.x - centre.x, centre.y - p.y) * 180) / Math.PI;
}

function entityBounds(e: { x: number; y: number; width: number; length: number; rotation?: number; shape?: Shape; points?: Point[] }) {
  if (shapeOf(e.shape) === "polygon" && e.points?.length) return polygonBounds(e.points);
  const rotation = rotOf(e.rotation);
  if (!rotation) return polygonBounds(rectCorners(e.x, e.y, e.width, e.length));
  return polygonBounds(rotatedRectCorners(e.x, e.y, e.width, e.length, rotation));
}

const RESIZE_HANDLES = [
  { id: "nw", dx: -1, dy: -1 },
  { id: "n", dx: 0, dy: -1 },
  { id: "ne", dx: 1, dy: -1 },
  { id: "e", dx: 1, dy: 0 },
  { id: "se", dx: 1, dy: 1 },
  { id: "s", dx: 0, dy: 1 },
  { id: "sw", dx: -1, dy: 1 },
  { id: "w", dx: -1, dy: 0 },
] as const;

const ROTATE_SNAP = 5; // degrees
const RESIZE_CURSORS = ["cursor-ns-resize", "cursor-nesw-resize", "cursor-ew-resize", "cursor-nwse-resize"];

function handleCursor(dx: number, dy: number, rotation: number): string {
  const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI + rotation;
  return RESIZE_CURSORS[Math.round((((bearing % 180) + 180) % 180) / 45) % 4];
}

function boxCentre(b: { x: number; y: number; width: number; length: number }): Point {
  return { x: b.x + b.width / 2, y: b.y + b.length / 2 };
}

function cornerAt(b: EditableBox, dx: number, dy: number): Point {
  const c = boxCentre(b);
  return rotateAbout({ x: c.x + (dx * b.width) / 2, y: c.y + (dy * b.length) / 2 }, c, b.rotation);
}

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

  const eventToWorldRaw = (e: React.PointerEvent): Point => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    return screenToWorld(e.clientX, e.clientY, el.getBoundingClientRect(), view.width, view.length);
  };
  const eventToWorld = (e: React.PointerEvent): Point => {
    const w = eventToWorldRaw(e);
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

  const patchEntity = (entity: EntityKind, id: string, patch: BoxPatch) => {
    if (entity === "obstacle") updateObstacle(id, patch);
    else if (entity === "fixture") updateFixture(id, patch);
    else updateFeature(id, patch);
  };

  const applyResize = (drag: Extract<DragState, { kind: "resize" }>, pointer: Point) => {
    patchEntity(drag.entity, drag.id, resizeRotatedBox(drag.anchor, pointer, { ...drag, minSize: MIN_SIZE }));
  };

  const setPolygonPoints = (entity: EntityKind, id: string, pts: Point[]) => {
    const b = polygonBounds(pts);
    const patch = {
      points: pts,
      x: round(b.minX),
      y: round(b.minY),
      width: round(b.width),
      length: round(b.length),
    };
    if (entity === "obstacle") updateObstacle(id, patch);
    else if (entity === "fixture") updateFixture(id, patch);
  };

  const applyResizePoly = (drag: Extract<DragState, { kind: "resizePoly" }>, pointer: Point) => {
    setPolygonPoints(
      drag.entity,
      drag.id,
      resizePolygon(drag.points, drag.anchor, pointer, { ...drag, minSize: MIN_SIZE })
    );
  };

  const applyRotatePoly = (drag: Extract<DragState, { kind: "rotatePoly" }>, pointer: Point) => {
    if (Math.hypot(pointer.x - drag.centre.x, pointer.y - drag.centre.y) < 1e-3) return;
    const delta = bearingTo(drag.centre, pointer) - drag.startBearing;
    const snapped = Math.round(delta / ROTATE_SNAP) * ROTATE_SNAP;
    setPolygonPoints(drag.entity, drag.id, rotatePolygonAbout(drag.points, drag.centre, snapped));
  };

  const applyRotate = (drag: Extract<DragState, { kind: "rotate" }>, pointer: Point) => {
    const vx = pointer.x - drag.cx;
    const vy = pointer.y - drag.cy;
    if (Math.hypot(vx, vy) < 1e-3) return;
    const bearing = (Math.atan2(vx, -vy) * 180) / Math.PI;
    const snapped = Math.round((((bearing % 360) + 360) % 360) / ROTATE_SNAP) * ROTATE_SNAP;
    patchEntity(drag.entity, drag.id, { rotation: snapped % 360 });
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "resize") return applyResize(drag, eventToWorld(e));
    if (drag.kind === "rotate") return applyRotate(drag, eventToWorldRaw(e));
    if (drag.kind === "resizePoly") return applyResizePoly(drag, eventToWorld(e));
    if (drag.kind === "rotatePoly") return applyRotatePoly(drag, eventToWorldRaw(e));
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

  const fontSize = clamp(Math.min(view.width, view.length) * 0.021, 0.1, 0.24);
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

  const labels = useMemo(() => {
    const toInput = (
      key: string,
      text: string,
      e: { x: number; y: number; width: number; length: number; rotation?: number; shape?: Shape; points?: Point[] },
      ink: string
    ): LabelInput => ({
      key,
      text,
      bounds: entityBounds(e),
      width: e.width,
      length: e.length,
      rotation: rotOf(e.rotation),
      outsideOnly: shapeOf(e.shape) === "polygon",
      ink,
    });

    return layoutLabels(
      [
        ...obstacles.map((o) => toInput(`ob-${o.id}`, o.label, o, "#991B1B")),
        ...fixtures.map((f) => toInput(`fx-${f.id}`, f.label, f, FIXTURE_META[f.type].stroke)),
        ...features.map((f) =>
          toInput(`ft-${f.id}`, f.kind === "bench" ? `${f.label} (${f.seats ?? 0})` : f.label, f, "#34451F")
        ),
      ],
      { fontSize, viewWidth: view.width }
    );
  }, [obstacles, fixtures, features, fontSize, view.width]);

  const editableBox: EditableBox | null = (() => {
    if (drawingPoly) return null;
    if (selection?.kind === "obstacleVertex" || selection?.kind === "fixtureVertex") return null;
    const base = (
      entity: EntityKind,
      e: { id: string; x: number; y: number; width: number; length: number; rotation?: number; shape?: Shape; points?: Point[] },
      stroke: string
    ): EditableBox => {
      const shape = shapeOf(e.shape);
      const isPoly = shape === "polygon" && !!e.points && e.points.length >= 3;
      return {
        entity,
        id: e.id,
        x: e.x,
        y: e.y,
        width: e.width,
        length: e.length,
        rotation: isPoly ? 0 : rotOf(e.rotation), // polygons bake rotation into their points
        circular: shape === "circle",
        stroke,
        points: isPoly ? e.points : undefined,
      };
    };
    if (mode === "obstacles" && selectedObstacle) {
      if (selectedObstacle.shape === "polygon" && !selectedObstacle.points) return null;
      return base("obstacle", selectedObstacle, "#DC2626");
    }
    if (mode === "fixtures" && selectedFixture) {
      if (shapeOf(selectedFixture.shape) === "polygon" && !selectedFixture.points) return null;
      return base("fixture", selectedFixture, FIXTURE_META[selectedFixture.type].stroke);
    }
    if (mode === "features" && selectedFeature) {
      return base("feature", { ...selectedFeature, shape: "rect" }, FEATURE_META[selectedFeature.kind].stroke);
    }
    return null;
  })();

  return (
    <div className="max-w-5xl space-y-4 px-2 py-2 sm:px-4 sm:py-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-admin-ink">Venue layout</h2>
          <p className="mt-0.5 text-[11px] font-medium text-admin-muted">
            {companyName ? `${companyName} - ` : ""}draw the room, drop obstacles, place fixtures, doors &amp; seating.
            Reused by every event&apos;s floor-plan calculator.
          </p>
        </div>
        {dirty ? (
          <StatusPill tone="warning" icon={<AlertCircle className="h-3 w-3" />} showLabelOnMobile>
            Unsaved
          </StatusPill>
        ) : savedAt ? (
          <StatusPill tone="success" icon={<CheckCircle2 className="h-3 w-3" />} showLabelOnMobile>
            Saved
          </StatusPill>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModeButton active={mode === "outline"} onClick={() => { setMode("outline"); setSelection(null); setDrawingPoly(null); }} icon={<Pentagon className="h-4 w-4" />} label="Room" />
        <ModeButton active={mode === "obstacles"} onClick={() => { setMode("obstacles"); setSelection(null); }} icon={<Ban className="h-4 w-4" />} label="Obstacles" />
        <ModeButton active={mode === "fixtures"} onClick={() => { setMode("fixtures"); setSelection(null); setDrawingPoly(null); }} icon={<Sofa className="h-4 w-4" />} label="Fixtures" />
        <ModeButton active={mode === "features"} onClick={() => { setMode("features"); setSelection(null); setDrawingPoly(null); }} icon={<DoorOpen className="h-4 w-4" />} label="Doors & Seating" />
      </div>

      <div className="rounded-2xl border border-admin-line bg-admin-card p-3">
        {mode === "outline" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <DimInput id="room-w" label="Room width (m)" value={roomW} onChange={(v) => { setRoomW(v); markDirty(); }} />
              <DimInput id="room-l" label="Room length (m)" value={roomL} onChange={(v) => { setRoomL(v); markDirty(); }} />
            </div>
            <p className={HINT}>
              <Info className="h-3 w-3 shrink-0" />
              Tap the canvas to add corner points (clockwise). Drag a point to move it.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={resetRectangle} className={BTN_ADD}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to rectangle
              </Button>
              <Button type="button" onClick={clearOutline} disabled={points.length === 0} className={BTN_NEUTRAL}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        )}

        {mode === "obstacles" && (
          <div className="space-y-3">
            {drawingPoly ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-admin-primary">
                  Drawing polygon - tap to add points ({drawingPoly.length})
                </span>
                <Button type="button" onClick={finishPolygonObstacle} disabled={drawingPoly.length < 3} className={BTN_ADD}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Finish
                </Button>
                <Button type="button" onClick={cancelPolygonObstacle} className={BTN_NEUTRAL}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => addRectObstacle("rect")} className={BTN_ADD}>
                  <SquareIcon className="mr-1 h-3.5 w-3.5" /> Rectangle
                </Button>
                <Button type="button" onClick={() => addRectObstacle("circle")} className={BTN_ADD}>
                  <CircleIcon className="mr-1 h-3.5 w-3.5" /> Circle
                </Button>
                <Button type="button" onClick={startPolygonObstacle} className={BTN_ADD}>
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
                <Button key={t} type="button" onClick={() => addFixture(t)} className={BTN_ADD}>
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
              <Button type="button" onClick={() => addFeature("door")} className={BTN_ADD}>
                <DoorOpen className="mr-1 h-3.5 w-3.5" /> Door
              </Button>
              <Button type="button" onClick={() => addFeature("window")} className={BTN_ADD}>
                <RectangleHorizontal className="mr-1 h-3.5 w-3.5" /> Window
              </Button>
              <Button type="button" onClick={() => addFeature("bench")} className={BTN_ADD}>
                <Armchair className="mr-1 h-3.5 w-3.5" /> Bench
              </Button>
            </div>
            <p className={HINT}>
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
        className="aspect-(--venue-ar) w-full overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card"
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
          <g stroke="#D8D5C8" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6}>
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
              fill={points.length >= 3 ? "#34451F" : "none"}
              fillOpacity={0.05}
              stroke="#34451F"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {obstacles.map((o) => {
            const isSel = selection?.kind === "obstacle" && selection.id === o.id;
            const stroke = isSel ? "#9A5B00" : "#DC2626";
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
                </g>
              </g>
            );
          })}

          {mode === "obstacles" && !drawingPoly && selectedObstacle?.shape === "polygon" && selectedObstacle.points &&
            selectedObstacle.points.map((p, i) => (
              <circle key={`ov${i}`} cx={p.x} cy={p.y} r={handleR} fill={selection?.kind === "obstacleVertex" && selection.index === i ? "#9A5B00" : "#FFFFFF"} stroke="#DC2626" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "obstacleVertex", id: selectedObstacle.id, index: i }, { kind: "obstacleVertex", id: selectedObstacle.id, index: i })} />
            ))}

          {drawingPoly && drawingPoly.length > 0 && (
            <g>
              <polyline points={drawingPoly.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#9A5B00" strokeWidth={2} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
              {drawingPoly.map((p, i) => (
                <circle key={`dp${i}`} cx={p.x} cy={p.y} r={handleR} fill="#FDCC4B" stroke="#9A5B00" strokeWidth={2} vectorEffect="non-scaling-stroke" />
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
            const common = { fill: meta.fill, fillOpacity: 0.85, stroke: isSel ? "#9A5B00" : meta.stroke, strokeWidth: isSel ? 3 : 1.5, vectorEffect: "non-scaling-stroke" as const };
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
                </g>
                {arrow && <FacingArrow cx={cx} cy={cy} dir={arrow} length={arrowLen} head={handleR} color="#FDCC4B" />}
              </g>
            );
          })}

          {mode === "fixtures" && selectedFixture && shapeOf(selectedFixture.shape) === "polygon" && selectedFixture.points &&
            selectedFixture.points.map((p, i) => (
              <circle key={`fv${i}`} cx={p.x} cy={p.y} r={handleR} fill={selection?.kind === "fixtureVertex" && selection.index === i ? "#9A5B00" : "#FFFFFF"} stroke={FIXTURE_META[selectedFixture.type].stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "fixtureVertex", id: selectedFixture.id, index: i }, { kind: "fixtureVertex", id: selectedFixture.id, index: i })} />
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
                  <rect x={f.x} y={f.y} width={f.width} height={f.length} fill={meta.fill} fillOpacity={f.kind === "window" ? 0.6 : 0.9} stroke={isSel ? "#9A5B00" : meta.stroke} strokeWidth={isSel ? 3 : 1.5} vectorEffect="non-scaling-stroke" rx={0.03} />
                  {seatPts.map((p, i) => (
                    <circle key={`bs${i}`} cx={p.x} cy={p.y} r={handleR * 0.8} fill="#FFFEFA" stroke={meta.stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
                {arrow && <FacingArrow cx={cx} cy={cy} dir={arrow} length={arrowLen} head={handleR * 0.85} color="#20231A" />}
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
                  fontSize={fontSize}
                  fontWeight={700}
                  fill={s.ink}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  paintOrder="stroke"
                  stroke="#FFFEFA"
                  strokeWidth={fontSize * 0.28}
                  strokeLinejoin="round"
                >
                  {s.text}
                </text>
              ) : (
                <g key={s.key}>
                  <line x1={s.cx} y1={s.cy} x2={s.x} y2={s.y} stroke={s.ink} strokeWidth={1} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
                  <rect
                    x={s.x - s.w / 2}
                    y={s.y - s.h / 2}
                    width={s.w}
                    height={s.h}
                    rx={s.h * 0.35}
                    fill="#FFFEFA"
                    fillOpacity={0.95}
                    stroke={s.ink}
                    strokeOpacity={0.4}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text x={s.x} y={s.y} fontSize={fontSize} fontWeight={700} fill={s.ink} textAnchor="middle" dominantBaseline="central">
                    {s.text}
                  </text>
                </g>
              )
            )}
          </g>

          {editableBox && (() => {
            const box = editableBox;
            const centre = boxCentre(box);
            const spin = handleR * 3;
            const pivot = rotateAbout({ x: centre.x, y: box.y - spin }, centre, box.rotation);
            const topEdge = rotateAbout({ x: centre.x, y: box.y }, centre, box.rotation);
            const handles = box.circular ? RESIZE_HANDLES.filter((h) => h.dx !== 0 && h.dy !== 0) : RESIZE_HANDLES;
            const size = handleR * 1.5;
            const poly = box.points;
            // Polygons already show a handle on every vertex, so nudge the box handles clear of them.
            const pad = poly ? handleR * 1.4 : 0;
            const outer: EditableBox = poly
              ? { ...box, x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, length: box.length + pad * 2 }
              : box;
            return (
              <g>
                <polygon
                  points={rectCorners(box.x, box.y, box.width, box.length)
                    .map((p) => rotateAbout(p, centre, box.rotation))
                    .map((p) => `${round(p.x, 3)},${round(p.y, 3)}`)
                    .join(" ")}
                  fill="none"
                  stroke="#9A5B00"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
                <line x1={topEdge.x} y1={topEdge.y} x2={pivot.x} y2={pivot.y} stroke="#9A5B00" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                <circle
                  cx={pivot.x}
                  cy={pivot.y}
                  r={handleR}
                  fill="#FDCC4B"
                  stroke="#9A5B00"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-grab"
                  onPointerDown={(e) =>
                    beginDrag(
                      e,
                      poly
                        ? {
                            kind: "rotatePoly",
                            entity: box.entity,
                            id: box.id,
                            centre,
                            startBearing: bearingTo(centre, eventToWorldRaw(e)),
                            points: poly,
                          }
                        : { kind: "rotate", entity: box.entity, id: box.id, cx: centre.x, cy: centre.y },
                      selection
                    )
                  }
                >
                  <title>Drag to rotate</title>
                </circle>
                {handles.map((h) => {
                  const at = cornerAt(outer, h.dx, h.dy);
                  const anchor = cornerAt(box, -h.dx, -h.dy);
                  return (
                    <rect
                      key={h.id}
                      x={at.x - size / 2}
                      y={at.y - size / 2}
                      width={size}
                      height={size}
                      rx={size * 0.2}
                      transform={box.rotation ? `rotate(${box.rotation} ${round(at.x, 3)} ${round(at.y, 3)})` : undefined}
                      fill="#FFFFFF"
                      stroke={box.stroke}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      className={handleCursor(h.dx, h.dy, box.rotation)}
                      onPointerDown={(e) =>
                        beginDrag(
                          e,
                          poly
                            ? {
                                kind: "resizePoly",
                                entity: box.entity,
                                id: box.id,
                                dx: h.dx,
                                dy: h.dy,
                                anchor,
                                width: box.width,
                                length: box.length,
                                points: poly,
                              }
                            : {
                                kind: "resize",
                                entity: box.entity,
                                id: box.id,
                                dx: h.dx,
                                dy: h.dy,
                                anchor,
                                rotation: box.rotation,
                                width: box.width,
                                length: box.length,
                                circular: box.circular,
                              },
                          selection
                        )
                      }
                    >
                      <title>Drag to resize</title>
                    </rect>
                  );
                })}
              </g>
            );
          })()}

          {mode === "outline" &&
            points.map((p, i) => {
              const isSel = selection?.kind === "vertex" && selection.index === i;
              return (
                <circle key={`v${i}`} cx={p.x} cy={p.y} r={handleR} fill={isSel ? "#9A5B00" : "#FFFFFF"} stroke="#34451F" strokeWidth={2} vectorEffect="non-scaling-stroke" className="cursor-move" onPointerDown={(e) => beginDrag(e, { kind: "vertex", index: i }, { kind: "vertex", index: i })} />
              );
            })}
        </svg>
      </div>

      {editableBox && (
        <p className={HINT}>
          <Info className="h-3 w-3 shrink-0" />
          Drag the square handles to resize, the gold handle above it to rotate, or the shape itself to move it.
          {editableBox.points ? " Polygons scale and spin every point together." : " The fields below stay in step."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-admin-muted">
        <span className="tabular-nums">{points.length} outline point{points.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">Area {round(roomArea, 1)} m²</span>
        <span className="tabular-nums">{obstacles.length} obstacle{obstacles.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">{fixtures.length} fixture{fixtures.length !== 1 ? "s" : ""}</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "door").length} door(s)</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "window").length} window(s)</span>
        <span className="tabular-nums">{features.filter((f) => f.kind === "bench").length} bench(es) · {benchSeatTotal} seat{benchSeatTotal !== 1 ? "s" : ""}</span>
      </div>

      {mode === "outline" && selection?.kind === "vertex" && points[selection.index] && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-admin-line bg-admin-card p-3">
          <DimInput id="vx" label="Point X (m)" value={points[selection.index].x} onChange={(v) => setPoints((prev) => prev.map((p, i) => (i === selection.index ? { ...p, x: v } : p)))} />
          <DimInput id="vy" label="Point Y (m)" value={points[selection.index].y} onChange={(v) => setPoints((prev) => prev.map((p, i) => (i === selection.index ? { ...p, y: v } : p)))} />
          <Button type="button" onClick={() => deleteVertex(selection.index)} disabled={points.length <= 3} className={cn(BTN_DANGER, "h-11")}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete point
          </Button>
        </div>
      )}

      {formError && <ErrorBox message={formError} />}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isPending || !companyId} className="h-12 rounded-xl bg-admin-primary px-6 text-[13px] font-semibold text-white shadow-lg hover:bg-admin-primary-hover active:scale-95 disabled:opacity-50">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save layout</>}
        </Button>
      </div>
    </div>
  );
}


function FacingArrow({ cx, cy, dir, length, head, color }: { cx: number; cy: number; dir: Point; length: number; head: number; color: string }) {
  const tip = { x: cx + dir.x * length, y: cy + dir.y * length };
  const back = { x: tip.x - dir.x * head * 1.8, y: tip.y - dir.y * head * 1.8 };
  const perp = { x: -dir.y * head * 0.8, y: dir.x * head * 0.8 };
  return (
    <g>
      <line x1={cx} y1={cy} x2={back.x} y2={back.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <polygon
        points={`${round(tip.x, 3)},${round(tip.y, 3)} ${round(back.x + perp.x, 3)},${round(back.y + perp.y, 3)} ${round(back.x - perp.x, 3)},${round(back.y - perp.y, 3)}`}
        fill={color}
      />
    </g>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all",
        active
          ? "border-admin-primary bg-admin-primary-soft text-admin-primary shadow-sm"
          : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:text-admin-ink"
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
      <Label htmlFor={id} className={FIELD_LABEL}>
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
        className={cn(FIELD_BOX, "w-28 tabular-nums")}
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
      <Label className={FIELD_LABEL}>Shape</Label>
      <div className="flex gap-1.5">
        {opts.map((o) => (
          <button
            key={o.s}
            type="button"
            onClick={() => onChange(o.s)}
            aria-label={`${o.label} shape`}
            aria-pressed={value === o.s}
            className={cn(
              "flex h-11 items-center gap-1 rounded-xl border px-2.5 text-[13px] font-semibold transition-all",
              value === o.s
                ? "border-admin-primary bg-admin-primary-soft text-admin-primary"
                : "border-admin-line bg-admin-card text-admin-muted hover:border-admin-primary/40 hover:text-admin-ink"
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
      <Label htmlFor="rot-input" className={FIELD_LABEL}>
        Rotation (°)
      </Label>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => set(value - 15)} aria-label="Rotate 15 degrees left" title="Rotate left" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-admin-card text-admin-primary hover:bg-admin-surface">
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
          className={cn(FIELD_BOX, "tabular-nums")}
        />
        <button type="button" onClick={() => set(value + 15)} aria-label="Rotate 15 degrees right" title="Rotate right" className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-admin-card text-admin-primary hover:bg-admin-surface">
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
    <div className={INSPECTOR}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ob-label" className={FIELD_LABEL}>Label</Label>
          <Input id="ob-label" value={obstacle.label} onChange={(e) => onChange({ label: e.target.value })} className={FIELD_BOX} />
        </div>
        <span className={KIND_PILL}>{obstacle.shape}</span>
      </div>
      {isPolygon ? (
        <p className={HINT}>
          <Info className="h-3 w-3 shrink-0" />
          Drag the red points to reshape, or the square handles around it to scale the whole outline. Bounds{" "}
          {round(obstacle.width, 1)} × {round(obstacle.length, 1)} m.
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
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
        {!isPolygon && <RotationField value={rotOf(obstacle.rotation)} onChange={(v) => onChange({ rotation: v })} />}
        <HeightField
          id="ob-height"
          label="Height (m)"
          value={obstacle.height}
          placeholder="Full height"
          onChange={(v) => onChange({ height: v })}
        />
      </div>
      <p className={HINT}>
        <Info className="h-3 w-3 shrink-0" />
        Leave the height blank and this always blocks the view. Set it and guests can see over anything lower than their
        eye line.
      </p>
      <Button type="button" onClick={onDelete} className={BTN_DANGER}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete obstacle
      </Button>
    </div>
  );
}

function FixtureInspector({ fixture, onChange, onShape, onDelete }: { fixture: Fixture; onChange: (patch: Partial<Fixture>) => void; onShape: (s: Shape) => void; onDelete: () => void }) {
  const showFacing = fixture.facing != null;
  const shape = shapeOf(fixture.shape);
  const blocks = BLOCKING_FIXTURE_TYPES.includes(fixture.type);
  const isFocal = FOCAL_FIXTURE_TYPES.includes(fixture.type);
  return (
    <div className={INSPECTOR}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fx-type" className={FIELD_LABEL}>Type</Label>
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
            className={cn(FIELD_BOX, "outline-none")}
          >
            {FIXTURE_ORDER.map((t) => (
              <option key={t} value={t}>{FIXTURE_META[t].label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fx-label" className={FIELD_LABEL}>Label</Label>
          <Input id="fx-label" value={fixture.label} onChange={(e) => onChange({ label: e.target.value })} className={FIELD_BOX} />
        </div>
      </div>
      <ShapeToggle value={shape} onChange={onShape} />
      {shape === "polygon" ? (
        <p className={HINT}>
          <Info className="h-3 w-3 shrink-0" />
          Drag the points to reshape, or the square handles around it to scale the whole outline. Bounds{" "}
          {round(fixture.width, 1)} × {round(fixture.length, 1)} m.
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
      {showFacing && <p className="text-[11px] font-medium text-admin-muted">Facing: 0° up · 90° right · 180° down · 270° left (sightline direction)</p>}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
        {blocks && (
          <HeightField
            id="fx-height"
            label="Blocks up to (m)"
            value={fixture.height}
            placeholder={`${DEFAULT_FIXTURE_HEIGHT[fixture.type]}`}
            onChange={(v) => onChange({ height: v })}
          />
        )}
        {isFocal && (
          <HeightField
            id="fx-view-height"
            label="Guests look at (m)"
            value={fixture.viewHeight}
            placeholder={`${DEFAULT_VIEW_HEIGHT[fixture.type]}`}
            onChange={(v) => onChange({ viewHeight: v })}
          />
        )}
      </div>
      <p className="text-[11px] font-medium text-admin-muted">
        {blocks && isFocal
          ? "How tall this stands, and how high up the thing guests actually watch sits."
          : blocks
            ? "How tall this stands. Guests seated at 1.2 m can see over anything lower."
            : "How high up the screen or performer sits - a higher target clears more obstacles."}
      </p>
      <Button type="button" onClick={onDelete} className={BTN_DANGER}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete fixture
      </Button>
    </div>
  );
}

function FeatureInspector({ feature, onChange, onDelete }: { feature: Feature; onChange: (patch: Partial<Feature>) => void; onDelete: () => void }) {
  const showFacing = feature.kind !== "window";
  const isBench = feature.kind === "bench";
  return (
    <div className={INSPECTOR}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ft-label" className={FIELD_LABEL}>Label</Label>
          <Input id="ft-label" value={feature.label} onChange={(e) => onChange({ label: e.target.value })} className={FIELD_BOX} />
        </div>
        <span className={KIND_PILL}>{feature.kind}</span>
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
        <HeightField
          id="ft-height"
          label="Height (m)"
          value={feature.height}
          placeholder={`${DEFAULT_FEATURE_HEIGHT[feature.kind]}`}
          onChange={(v) => onChange({ height: v })}
        />
      </div>
      {showFacing && <p className="text-[11px] font-medium text-admin-muted">Facing: 0° up · 90° right · 180° down · 270° left</p>}
      <Button type="button" onClick={onDelete} className={BTN_DANGER}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete {feature.kind}
      </Button>
    </div>
  );
}

function HeightField({ id, label, value, placeholder, onChange }: { id: string; label: string; value: number | undefined; placeholder: string; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={FIELD_LABEL}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={10}
        step={0.1}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? round(Math.min(10, Math.max(0, n))) : undefined);
        }}
        className={cn(FIELD_BOX, "tabular-nums")}
      />
    </div>
  );
}

function NumField({ id, label, value, min = 0, max, step = 0.1, onChange }: { id: string; label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={FIELD_LABEL}>{label}</Label>
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
        className={cn(FIELD_BOX, "tabular-nums")}
      />
    </div>
  );
}
