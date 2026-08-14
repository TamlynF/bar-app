import {
  polygonBounds,
  polygonArea,
  pointInPolygon,
  facingToVector,
  doorClearancePolygon,
  rotatedRectCorners,
  rotatedEllipseBounds,
  rotatePoint,
  convexPolygonsOverlap,
  round,
} from "./geometry";
import { computeTableChairs, chairGapFor } from "./chairs";
import type {
  Point,
  RoomOutline,
  Obstacle,
  Fixture,
  Feature,
  FixtureType,
  ChairLayout,
} from "./types";
import {
  FOCAL_FIXTURE_TYPES,
  BLOCKING_FIXTURE_TYPES,
  ANGLE_LIMITS,
  EYE_HEIGHT,
  fixtureBlockHeight,
  fixtureViewHeight,
  featureBlockHeight,
} from "./types";

export type SightRating = "good" | "acceptable" | "poor";

export type CalcTable = {
  mappingId: number;
  tableId: number;
  name: string;
  shape: "round" | "rect";
  diameter: number | null;
  width: number | null;
  length: number | null;
  baseSeats: number; // effective base seats (from chair layout, or tables.max_capacity)
  extraChairs: number; // booking_table_mappings.add_seat
  chairLayout: ChairLayout | null;
  isManual?: boolean; // added directly on the calculator (no booking)
};

export type TableSpec = Pick<CalcTable, "shape" | "diameter" | "width" | "length">;

export type FocalPoint = {
  id: string;
  type: FixtureType;
  label: string;
  center: Point;
  facing: number | null;
  height: number; // what guests look at, above the floor (m)
};

export type AABB = { minX: number; minY: number; maxX: number; maxY: number };

export type Blocker = AABB & {
  height?: number; // omitted = full height, always blocks
  label?: string;
  corners?: Point[]; // true footprint when it is not axis-aligned; the box is only a fast reject
};

export type SightIssue =
  | { kind: "blocked"; label: string }
  | { kind: "distance"; metres: number }
  | { kind: "angle"; degrees: number };

export type SightVerdict = { rating: SightRating; issue: SightIssue | null };

export type SeatView = {
  x: number; // world position of the seat (m)
  y: number;
  rating: SightRating;
  focalId: string | null; // the focal responsible for the rating
  focalLabel: string | null;
  issue: SightIssue | null;
};

export type Slot = { w: number; l: number };

export type CalcSettings = {
  chairZone: number; // m reserved around a table for a seated guest + pull-out
  aisleWidth: number; // m clearance between table cells
  mustSee: string[]; // focal ids that every seat must be able to see
};

export type TablePlacement = {
  mappingId: number;
  tableId: number;
  name: string;
  shape: "round" | "rect";
  x: number; // centre (m)
  y: number;
  rotation: number;
  width: number; // actual table width (x extent, m)
  length: number; // actual table length (y extent, m)
  diameter: number; // round tables (m)
  baseSeats: number;
  extraChairs: number;
  chairLayout: ChairLayout | null;
  isManual: boolean;
  sightlines: Record<string, SightRating>;
  worstRating: SightRating | null; // worst across every focal in the venue
  mustSeeRating: SightRating | null; // worst across the required focals only; null when none are required
  mustSeeViolation: boolean;
  seats: SeatView[]; // scored per chair, against the required focals when any are set
};

export type CalcWarning = { level: "error" | "warn"; message: string };

export type FloorPlanResult = {
  placements: TablePlacement[];
  unplaced: CalcTable[];
  cellsAvailable: number;
  warnings: CalcWarning[];
  stats: {
    tablesPlaced: number;
    tablesConfirmed: number;
    tablesAvailable: number;
    totalSeats: number;
    benchSeats: number;
    aisleWidth: number;
    chairZone: number;
    utilisation: number; // 0-1, occupied footprint ÷ room area
    roomArea: number;
    mustSeeCompliant: boolean;
  };
};

export const MIN_AISLE = 0.9; // WCAG clearance minimum (m)

const ROUND_FALLBACK = 1.1;
const RECT_FALLBACK_W = 1.2;
const RECT_FALLBACK_L = 0.7;
const INSET = 0.999; // pull probe points just inside the footprint edge
const MIN_PITCH = 0.2;
const MAX_PITCH = 0.5;
const ORIGIN_STEPS = 3; // lattice origins tried per axis

function dimension(value: number | null | undefined, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function tableSlot(t: TableSpec, chairZone: number): Slot {
  const zone = Math.max(0, chairZone);
  if (t.shape === "round") {
    const d = dimension(t.diameter, ROUND_FALLBACK);
    return { w: d + 2 * zone, l: d + 2 * zone };
  }
  return {
    w: dimension(t.width, RECT_FALLBACK_W) + 2 * zone,
    l: dimension(t.length, RECT_FALLBACK_L) + 2 * zone,
  };
}

export function orientSlot(slot: Slot, rotation: number): Slot {
  const r = (((rotation || 0) % 180) + 180) % 180;
  return r > 45 && r < 135 ? { w: slot.l, l: slot.w } : { w: slot.w, l: slot.l };
}

export function slotArea(slot: Slot): number {
  return slot.w * slot.l;
}

function aabbOf(x: number, y: number, w: number, l: number): AABB {
  return { minX: x, minY: y, maxX: x + w, maxY: y + l };
}

function pointsBounds(pts: Point[]): AABB {
  const b = polygonBounds(pts);
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
}

function expand(box: AABB, by: number): AABB {
  return { minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function aabbContains(box: AABB, p: Point): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

export function segmentAABBRange(p1: Point, p2: Point, box: AABB): { t0: number; t1: number } | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0; // parallel: inside iff q>=0
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (
    clip(-dx, p1.x - box.minX) &&
    clip(dx, box.maxX - p1.x) &&
    clip(-dy, p1.y - box.minY) &&
    clip(dy, box.maxY - p1.y) &&
    t0 <= t1
  ) {
    return { t0, t1 };
  }
  return null;
}

export function segmentIntersectsAABB(p1: Point, p2: Point, box: AABB): boolean {
  return segmentAABBRange(p1, p2, box) !== null;
}

export function focalPointsFrom(fixtures: Fixture[]): FocalPoint[] {
  return fixtures
    .filter((f) => FOCAL_FIXTURE_TYPES.includes(f.type))
    .map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      center: { x: f.x + f.width / 2, y: f.y + f.length / 2 },
      facing: f.facing,
      height: fixtureViewHeight(f),
    }));
}

type PlacedShape = {
  shape?: "rect" | "circle" | "polygon";
  x: number;
  y: number;
  width: number;
  length: number;
  points?: Point[];
  rotation?: number;
};

export function shapeOutline(e: PlacedShape): { box: AABB; corners?: Point[] } {
  if (e.shape === "polygon" && e.points && e.points.length >= 3) {
    return { box: pointsBounds(e.points), corners: e.points };
  }
  const rotation = (((e.rotation ?? 0) % 360) + 360) % 360;
  if (!rotation) return { box: aabbOf(e.x, e.y, e.width, e.length) };
  if (e.shape === "circle") {
    const b = rotatedEllipseBounds(e.x, e.y, e.width, e.length, rotation);
    return { box: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } };
  }
  const corners = rotatedRectCorners(e.x, e.y, e.width, e.length, rotation);
  return { box: pointsBounds(corners), corners };
}

export function shapeBounds(e: PlacedShape): AABB {
  return shapeOutline(e).box;
}

function cornersOf(box: AABB): Point[] {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

export function blockerHitsRect(blocker: Blocker, rect: AABB): boolean {
  if (!aabbOverlap(rect, blocker)) return false;
  if (!blocker.corners) return true;
  return convexPolygonsOverlap(blocker.corners, cornersOf(rect));
}

export function buildBlockers(obstacles: Obstacle[], fixtures: Fixture[], features: Feature[]): Blocker[] {
  const blockers: Blocker[] = [];
  const outline = (e: PlacedShape) => {
    const { box, corners } = shapeOutline(e);
    return { ...box, corners };
  };
  for (const o of obstacles) {
    blockers.push({ ...outline(o), height: o.height, label: o.label });
  }
  for (const f of fixtures) {
    if (BLOCKING_FIXTURE_TYPES.includes(f.type)) {
      blockers.push({ ...outline(f), height: fixtureBlockHeight(f), label: f.label });
    }
  }
  for (const ft of features) {
    if (ft.kind === "bench") {
      blockers.push({ ...outline(ft), height: featureBlockHeight(ft), label: ft.label });
    } else if (ft.kind === "door") {
      blockers.push({ ...outline(ft), height: featureBlockHeight(ft), label: ft.label });
      if (ft.facing != null) {
        const cx = ft.x + ft.width / 2;
        const cy = ft.y + ft.length / 2;
        const dw = Math.max(ft.width, ft.length);
        blockers.push({
          ...pointsBounds(doorClearancePolygon({ x: cx, y: cy }, ft.facing, dw, dw)),
          height: 0, // keep-clear floor area: reserves space, never blocks a view
          label: `${ft.label} clearance`,
        });
      }
    }
  }
  return blockers;
}

export function tableFootprint(center: Point, slot: Slot): AABB {
  const hw = slot.w / 2;
  const hl = slot.l / 2;
  return { minX: center.x - hw, minY: center.y - hl, maxX: center.x + hw, maxY: center.y + hl };
}

export function slotInsideRoom(room: Point[], center: Point, slot: Slot): boolean {
  if (room.length < 3) return false;
  const hw = (slot.w / 2) * INSET;
  const hl = (slot.l / 2) * INSET;
  const probes: Point[] = [
    center,
    { x: center.x - hw, y: center.y - hl },
    { x: center.x + hw, y: center.y - hl },
    { x: center.x + hw, y: center.y + hl },
    { x: center.x - hw, y: center.y + hl },
    { x: center.x, y: center.y - hl },
    { x: center.x, y: center.y + hl },
    { x: center.x - hw, y: center.y },
    { x: center.x + hw, y: center.y },
  ];
  return probes.every((p) => pointInPolygon(p, room));
}

export function anchorPitch(slots: Slot[]): number {
  const dims = slots.flatMap((s) => [s.w, s.l]).filter((d) => d > 0);
  const smallest = dims.length ? Math.min(...dims) : ROUND_FALLBACK;
  return Math.max(MIN_PITCH, Math.min(MAX_PITCH, smallest / 4));
}

export function buildAnchors(room: Point[], pitch: number, offsetX = 0, offsetY = 0): Point[] {
  if (room.length < 3 || pitch <= 0) return [];
  const b = polygonBounds(room);
  const eps = 1e-6;
  const anchors: Point[] = [];
  for (let y = b.minY + offsetY; y <= b.maxY + eps; y += pitch) {
    for (let x = b.minX + offsetX; x <= b.maxX + eps; x += pitch) {
      anchors.push({ x, y });
    }
  }
  return anchors;
}

const DIST_GOOD = 8;
const DIST_OK = 16;

function worse(a: SightRating, b: SightRating): SightRating {
  const order: SightRating[] = ["good", "acceptable", "poor"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

export function sightlineBlocked(center: Point, focal: FocalPoint, blocker: Blocker): boolean {
  if (aabbContains(blocker, focal.center) || aabbContains(blocker, center)) return false;
  const crossing = segmentAABBRange(center, focal.center, blocker);
  if (!crossing) return false;
  if (blocker.height == null) return true;
  const rise = focal.height - EYE_HEIGHT;
  const lowest = EYE_HEIGHT + rise * Math.min(crossing.t0, crossing.t1);
  return lowest <= blocker.height;
}

export function explainSightline(center: Point, focal: FocalPoint, blockers: Blocker[]): SightVerdict {
  const dx = focal.center.x - center.x;
  const dy = focal.center.y - center.y;
  const dist = Math.hypot(dx, dy);
  const distRating: SightRating = dist <= DIST_GOOD ? "good" : dist <= DIST_OK ? "acceptable" : "poor";

  let angle = 0;
  let angleRating: SightRating = "good";
  if (focal.facing != null && dist > 1e-6) {
    const fwd = facingToVector(focal.facing);
    const toViewer = { x: -dx / dist, y: -dy / dist };
    const cos = Math.max(-1, Math.min(1, fwd.x * toViewer.x + fwd.y * toViewer.y));
    angle = (Math.acos(cos) * 180) / Math.PI;
    const limit = ANGLE_LIMITS[focal.type];
    angleRating = angle <= limit.good ? "good" : angle <= limit.ok ? "acceptable" : "poor";
  }

  for (const bl of blockers) {
    if (sightlineBlocked(center, focal, bl)) {
      return { rating: "poor", issue: { kind: "blocked", label: bl.label ?? "an obstacle" } };
    }
  }

  const rating = worse(distRating, angleRating);
  if (rating === "good") return { rating, issue: null };
  return {
    rating,
    issue:
      angleRating === rating
        ? { kind: "angle", degrees: Math.round(angle) }
        : { kind: "distance", metres: round(dist, 1) },
  };
}

export function scoreSightline(center: Point, focal: FocalPoint, blockers: Blocker[]): SightRating {
  return explainSightline(center, focal, blockers).rating;
}

export function describeSightIssue(issue: SightIssue | null, focalLabel: string): string {
  if (!issue) return `can see ${focalLabel}`;
  if (issue.kind === "blocked") return `${focalLabel} is hidden behind ${issue.label}`;
  if (issue.kind === "distance") return `${focalLabel} is ${issue.metres} m away`;
  return `sits ${issue.degrees}° off to the side of ${focalLabel}`;
}

function evaluatePosition(
  center: Point,
  focals: FocalPoint[],
  blockers: Blocker[],
  mustSee: string[]
): {
  sightlines: Record<string, SightRating>;
  worst: SightRating | null;
  mustSeeRating: SightRating | null;
  mustSeeViolation: boolean;
} {
  const sightlines: Record<string, SightRating> = {};
  let worst: SightRating | null = null;
  let mustSeeRating: SightRating | null = null;
  let mustSeeViolation = false;
  for (const focal of focals) {
    const r = scoreSightline(center, focal, blockers);
    sightlines[focal.id] = r;
    worst = worst == null ? r : worse(worst, r);
    if (mustSee.includes(focal.id)) {
      mustSeeRating = mustSeeRating == null ? r : worse(mustSeeRating, r);
      if (r === "poor") mustSeeViolation = true;
    }
  }
  return { sightlines, worst, mustSeeRating, mustSeeViolation };
}

const RATING_ORDER: Record<SightRating, number> = { good: 0, acceptable: 1, poor: 2 };

export function seatViewsFor(
  placement: Omit<TablePlacement, "seats">,
  focals: FocalPoint[],
  blockers: Blocker[],
  chairZone: number
): SeatView[] {
  const { seats } = computeTableChairs({
    shape: placement.shape,
    cx: placement.x,
    cy: placement.y,
    width: placement.width,
    length: placement.length,
    diameter: placement.diameter,
    chairGap: chairGapFor(chairZone),
    baseSeats: placement.baseSeats,
    extraChairs: placement.extraChairs,
    layout: placement.chairLayout,
  });
  const centre = { x: placement.x, y: placement.y };
  return seats.map((seat) => {
    const at = placement.rotation ? rotatePoint(seat, centre, placement.rotation) : seat;
    let view: SeatView = { x: round(at.x), y: round(at.y), rating: "good", focalId: null, focalLabel: null, issue: null };
    for (const focal of focals) {
      const verdict = explainSightline(at, focal, blockers);
      if (RATING_ORDER[verdict.rating] > RATING_ORDER[view.rating]) {
        view = { ...view, rating: verdict.rating, focalId: focal.id, focalLabel: focal.label, issue: verdict.issue };
      }
    }
    return view;
  });
}

function orderAnchors(
  anchors: Point[],
  focals: FocalPoint[],
  blockers: AABB[],
  mustSee: string[]
): Point[] {
  if (mustSee.length === 0 || focals.length === 0) return anchors;
  return anchors
    .map((c, i) => {
      const ok = mustSee.every((id) => {
        const focal = focals.find((f) => f.id === id);
        return focal ? scoreSightline(c, focal, blockers) !== "poor" : true;
      });
      return { c, i, ok };
    })
    .sort((a, b) => (a.ok === b.ok ? a.i - b.i : a.ok ? -1 : 1))
    .map((e) => e.c);
}

export type PackItem = { id: number; slot: Slot };

export type PackedPosition = { x: number; y: number; rotation: number };

export type PackRun = { positions: Map<number, PackedPosition>; occupied: AABB[] };

function orientationsOf(slot: Slot): Array<{ slot: Slot; rotation: number }> {
  const upright = { slot, rotation: 0 };
  if (Math.abs(slot.w - slot.l) < 1e-6) return [upright];
  return [upright, { slot: orientSlot(slot, 90), rotation: 90 }];
}

export function packAtAnchors(
  room: Point[],
  blockers: AABB[],
  anchors: Point[],
  items: PackItem[],
  reserved: AABB[],
  aisle: number
): PackRun {
  const occupied = [...reserved];
  const positions = new Map<number, PackedPosition>();
  const gap = Math.max(0, aisle);
  for (const item of items) {
    const orientations = orientationsOf(item.slot);
    let done = false;
    for (const anchor of anchors) {
      for (const o of orientations) {
        if (!slotInsideRoom(room, anchor, o.slot)) continue;
        const foot = tableFootprint(anchor, o.slot);
        if (blockers.some((bl) => blockerHitsRect(bl, foot))) continue;
        if (occupied.some((other) => aabbOverlap(expand(foot, gap), other))) continue;
        positions.set(item.id, { x: round(anchor.x), y: round(anchor.y), rotation: o.rotation });
        occupied.push(foot);
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return { positions, occupied };
}

type PackResult = PackRun & { anchors: Point[] };

function packTables(
  room: Point[],
  blockers: AABB[],
  focals: FocalPoint[],
  mustSee: string[],
  items: PackItem[],
  reserved: AABB[],
  aisle: number
): PackResult {
  const pitch = anchorPitch(items.map((i) => i.slot));
  let best: PackResult | null = null;
  for (let iy = 0; iy < ORIGIN_STEPS; iy++) {
    for (let ix = 0; ix < ORIGIN_STEPS; ix++) {
      const anchors = orderAnchors(
        buildAnchors(room, pitch, (ix / ORIGIN_STEPS) * pitch, (iy / ORIGIN_STEPS) * pitch),
        focals,
        blockers,
        mustSee
      );
      const run = packAtAnchors(room, blockers, anchors, items, reserved, aisle);
      if (!best || run.positions.size > best.positions.size) best = { ...run, anchors };
      if (best.positions.size === items.length) return best;
    }
  }
  return best ?? { positions: new Map(), occupied: [...reserved], anchors: [] };
}

export function findFreeSlot(
  room: Point[],
  blockers: AABB[],
  occupied: AABB[],
  slot: Slot,
  aisle: number
): PackedPosition | null {
  const anchors = buildAnchors(room, anchorPitch([slot]));
  const run = packAtAnchors(room, blockers, anchors, [{ id: 0, slot }], occupied, aisle);
  return run.positions.get(0) ?? null;
}

export type TableOverride = { x: number; y: number; rotation: number };

export type FloorPlanInput = {
  room: RoomOutline | null;
  blockers: Blocker[];
  focals: FocalPoint[];
  tables: CalcTable[];
  availableCount: number;
  benchSeats: number;
  settings: CalcSettings;
  overrides?: Record<number, TableOverride>;
  spareTables?: TableSpec[];
};

export function computeFloorPlan(input: FloorPlanInput): FloorPlanResult {
  const { room, blockers, focals, tables, availableCount, benchSeats, settings } = input;
  const overrides = input.overrides ?? {};
  const warnings: CalcWarning[] = [];

  const roomPts = room?.points ?? [];
  const roomArea = roomPts.length >= 3 ? polygonArea(roomPts) : 0;

  const baseStats = {
    tablesPlaced: 0,
    tablesConfirmed: tables.length,
    tablesAvailable: availableCount,
    totalSeats: 0,
    benchSeats,
    aisleWidth: round(settings.aisleWidth),
    chairZone: round(settings.chairZone),
    utilisation: 0,
    roomArea: round(roomArea, 1),
    mustSeeCompliant: true,
  };

  if (roomPts.length < 3) {
    warnings.push({ level: "error", message: "No room outline configured. Set one in Settings → Venue Layout." });
    return { placements: [], unplaced: tables, cellsAvailable: 0, warnings, stats: baseStats };
  }

  const slots = new Map<number, Slot>(
    tables.map((t) => [t.mappingId, tableSlot(t, settings.chairZone)])
  );
  const slotOf = (t: CalcTable): Slot => slots.get(t.mappingId) ?? tableSlot(t, settings.chairZone);

  // A pinned table holds its ground; the rest pack into whatever is genuinely left.
  const reserved: AABB[] = [];
  for (const t of tables) {
    const ov = overrides[t.mappingId];
    if (ov) reserved.push(tableFootprint({ x: ov.x, y: ov.y }, orientSlot(slotOf(t), ov.rotation)));
  }

  const items: PackItem[] = tables
    .filter((t) => !overrides[t.mappingId])
    .map((t) => ({ id: t.mappingId, slot: slotOf(t) }))
    .sort((a, b) => slotArea(b.slot) - slotArea(a.slot));

  const pack = packTables(
    roomPts,
    blockers,
    focals,
    settings.mustSee,
    items,
    reserved,
    settings.aisleWidth
  );

  const seatFocals = settings.mustSee.length
    ? focals.filter((f) => settings.mustSee.includes(f.id))
    : focals;

  const placements: TablePlacement[] = [];
  const unplaced: CalcTable[] = [];
  for (const t of tables) {
    const ov = overrides[t.mappingId];
    const pos = ov ?? pack.positions.get(t.mappingId);
    if (!pos) {
      unplaced.push(t);
      continue;
    }
    const center = { x: pos.x, y: pos.y };
    const { sightlines, worst, mustSeeRating, mustSeeViolation } = evaluatePosition(
      center,
      focals,
      blockers,
      settings.mustSee
    );
    const dia = t.shape === "round" ? dimension(t.diameter, ROUND_FALLBACK) : 0;
    const wdt = t.shape === "round" ? dia : dimension(t.width, RECT_FALLBACK_W);
    const len = t.shape === "round" ? dia : dimension(t.length, RECT_FALLBACK_L);
    const base: Omit<TablePlacement, "seats"> = {
      mappingId: t.mappingId,
      tableId: t.tableId,
      name: t.name,
      shape: t.shape,
      x: round(center.x),
      y: round(center.y),
      rotation: round(pos.rotation),
      width: round(wdt),
      length: round(len),
      diameter: round(dia),
      baseSeats: t.baseSeats,
      extraChairs: t.extraChairs,
      chairLayout: t.chairLayout,
      isManual: !!t.isManual,
      sightlines,
      worstRating: worst,
      mustSeeRating,
      mustSeeViolation,
    };
    placements.push({ ...base, seats: seatViewsFor(base, seatFocals, blockers, settings.chairZone) });
  }

  const footSlots = placements.map((p) => orientSlot(tableSlot(p, settings.chairZone), p.rotation));
  const foots = placements.map((p, i) => tableFootprint({ x: p.x, y: p.y }, footSlots[i]));

  const spareItems: PackItem[] = (input.spareTables ?? []).map((t, i) => ({
    id: i,
    slot: tableSlot(t, settings.chairZone),
  }));
  const spareCapacity = spareItems.length
    ? packAtAnchors(roomPts, blockers, pack.anchors, spareItems, foots, settings.aisleWidth).positions.size
    : 0;

  if (tables.length > availableCount) {
    warnings.push({
      level: "error",
      message: `${tables.length} confirmed tables exceed ${availableCount} available table${availableCount === 1 ? "" : "s"}.`,
    });
  }
  if (unplaced.length > 0) {
    warnings.push({
      level: "warn",
      message: `Only ${placements.length} of ${tables.length} tables fit - ${unplaced.length} could not be placed.`,
    });
  }
  if (settings.aisleWidth < MIN_AISLE) {
    warnings.push({
      level: "warn",
      message: `Aisle ${round(settings.aisleWidth)} m is below the WCAG minimum of ${MIN_AISLE} m.`,
    });
  }
  for (const id of settings.mustSee) {
    const focal = focals.find((f) => f.id === id);
    if (!focal) continue;
    const offenders = placements.filter((p) => p.sightlines[id] === "poor").length;
    if (offenders > 0) {
      warnings.push({
        level: "error",
        message: `${offenders} table${offenders === 1 ? "" : "s"} cannot see ${focal.label} (required must-see).`,
      });
    }
  }
  const mustSeeCompliant = !placements.some((p) => p.mustSeeViolation);

  let outside = 0;
  let blockedTables = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (!slotInsideRoom(roomPts, { x: p.x, y: p.y }, footSlots[i])) outside++;
    if (blockers.some((bl) => blockerHitsRect(bl, foots[i]))) blockedTables++;
  }
  let overlapPairs = 0;
  for (let i = 0; i < foots.length; i++) {
    for (let j = i + 1; j < foots.length; j++) {
      if (aabbOverlap(foots[i], foots[j])) overlapPairs++;
    }
  }
  if (outside > 0) {
    warnings.push({ level: "warn", message: `${outside} table${outside === 1 ? "" : "s"} sit outside the room outline (chairs may not fit).` });
  }
  if (blockedTables > 0) {
    warnings.push({ level: "warn", message: `${blockedTables} table${blockedTables === 1 ? "" : "s"} overlap an obstacle, fixture or door zone.` });
  }
  if (overlapPairs > 0) {
    warnings.push({ level: "warn", message: `${overlapPairs} pair${overlapPairs === 1 ? "" : "s"} of tables overlap.` });
  }

  const tableSeats = placements.reduce((sum, p) => sum + p.baseSeats + p.extraChairs, 0);
  const occupied = footSlots.reduce((sum, s) => sum + slotArea(s), 0);

  return {
    placements,
    unplaced,
    cellsAvailable: placements.length + spareCapacity,
    warnings,
    stats: {
      ...baseStats,
      tablesPlaced: placements.length,
      totalSeats: tableSeats + benchSeats,
      utilisation: roomArea > 0 ? Math.min(1, round(occupied / roomArea, 3)) : 0,
      mustSeeCompliant,
    },
  };
}
