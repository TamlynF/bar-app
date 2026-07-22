import {
  polygonBounds,
  polygonArea,
  pointInPolygon,
  facingToVector,
  doorClearancePolygon,
  round,
} from "./geometry";
import type {
  Point,
  RoomOutline,
  Obstacle,
  Fixture,
  Feature,
  FixtureType,
  ChairLayout,
} from "./types";
import { FOCAL_FIXTURE_TYPES, BLOCKING_FIXTURE_TYPES } from "./types";

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

export type FocalPoint = {
  id: string;
  type: FixtureType;
  label: string;
  center: Point;
  facing: number | null;
};

export type AABB = { minX: number; minY: number; maxX: number; maxY: number };

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
  span: number; // table footprint span (m, table only)
  width: number; // actual table width (x extent, m)
  length: number; // actual table length (y extent, m)
  diameter: number; // round tables (m)
  baseSeats: number;
  extraChairs: number;
  chairLayout: ChairLayout | null;
  isManual: boolean;
  sightlines: Record<string, SightRating>;
  worstRating: SightRating | null;
  mustSeeViolation: boolean;
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

export function tableSpan(t: Pick<CalcTable, "shape" | "diameter" | "width" | "length">): number {
  if (t.shape === "round") return t.diameter && t.diameter > 0 ? t.diameter : 1.1;
  const w = t.width && t.width > 0 ? t.width : 1.2;
  const l = t.length && t.length > 0 ? t.length : 0.7;
  return Math.max(w, l);
}

function aabbOf(x: number, y: number, w: number, l: number): AABB {
  return { minX: x, minY: y, maxX: x + w, maxY: y + l };
}

function pointsBounds(pts: Point[]): AABB {
  const b = polygonBounds(pts);
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function aabbContains(box: AABB, p: Point): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

export function segmentIntersectsAABB(p1: Point, p2: Point, box: AABB): boolean {
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
    clip(dy, box.maxY - p1.y)
  ) {
    return t0 <= t1;
  }
  return false;
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
    }));
}

export function buildBlockers(obstacles: Obstacle[], fixtures: Fixture[], features: Feature[]): AABB[] {
  const blockers: AABB[] = [];
  for (const o of obstacles) {
    blockers.push(o.shape === "polygon" && o.points ? pointsBounds(o.points) : aabbOf(o.x, o.y, o.width, o.length));
  }
  for (const f of fixtures) {
    if (BLOCKING_FIXTURE_TYPES.includes(f.type)) {
      blockers.push(
        f.shape === "polygon" && f.points ? pointsBounds(f.points) : aabbOf(f.x, f.y, f.width, f.length)
      );
    }
  }
  for (const ft of features) {
    if (ft.kind === "bench") {
      blockers.push(aabbOf(ft.x, ft.y, ft.width, ft.length));
    } else if (ft.kind === "door") {
      blockers.push(aabbOf(ft.x, ft.y, ft.width, ft.length));
      if (ft.facing != null) {
        const cx = ft.x + ft.width / 2;
        const cy = ft.y + ft.length / 2;
        const dw = Math.max(ft.width, ft.length);
        blockers.push(pointsBounds(doorClearancePolygon({ x: cx, y: cy }, ft.facing, dw, dw)));
      }
    }
  }
  return blockers;
}

function footprintInside(room: Point[], c: Point, half: number): boolean {
  const k = 0.999; // pull corners just inside
  const probes: Point[] = [
    c,
    { x: c.x - half * k, y: c.y - half * k },
    { x: c.x + half * k, y: c.y - half * k },
    { x: c.x + half * k, y: c.y + half * k },
    { x: c.x - half * k, y: c.y + half * k },
  ];
  return probes.every((p) => pointInPolygon(p, room));
}

export function generateCells(
  room: Point[],
  blockers: AABB[],
  cellSize: number,
  aisle: number
): Point[] {
  if (room.length < 3 || cellSize <= 0) return [];
  const b = polygonBounds(room);
  const half = cellSize / 2;
  const step = cellSize + Math.max(0, aisle);
  const cells: Point[] = [];
  const eps = 1e-6;
  let rowIndex = 0;
  for (let cy = b.minY + half; cy <= b.maxY - half + eps; cy += step, rowIndex++) {
    const offset = rowIndex % 2 === 1 ? step / 2 : 0;
    for (let cx = b.minX + half + offset; cx <= b.maxX - half + eps; cx += step) {
      const c = { x: cx, y: cy };
      if (!footprintInside(room, c, half)) continue;
      const foot: AABB = { minX: cx - half, minY: cy - half, maxX: cx + half, maxY: cy + half };
      if (blockers.some((bl) => aabbOverlap(foot, bl))) continue;
      cells.push({ x: round(cx), y: round(cy) });
    }
  }
  return cells;
}

const DIST_GOOD = 8;
const DIST_OK = 16;
const ANGLE_GOOD = 50; // degrees off the focal's forward axis
const ANGLE_OK = 95;

function worse(a: SightRating, b: SightRating): SightRating {
  const order: SightRating[] = ["good", "acceptable", "poor"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

export function scoreSightline(center: Point, focal: FocalPoint, blockers: AABB[]): SightRating {
  const dx = focal.center.x - center.x;
  const dy = focal.center.y - center.y;
  const dist = Math.hypot(dx, dy);

  let rating: SightRating = dist <= DIST_GOOD ? "good" : dist <= DIST_OK ? "acceptable" : "poor";

  if (focal.facing != null && dist > 1e-6) {
    const fwd = facingToVector(focal.facing);
    const toViewer = { x: -dx / dist, y: -dy / dist };
    const cos = Math.max(-1, Math.min(1, fwd.x * toViewer.x + fwd.y * toViewer.y));
    const angle = (Math.acos(cos) * 180) / Math.PI;
    const angleRating: SightRating = angle <= ANGLE_GOOD ? "good" : angle <= ANGLE_OK ? "acceptable" : "poor";
    rating = worse(rating, angleRating);
  }

  for (const bl of blockers) {
    if (aabbContains(bl, focal.center) || aabbContains(bl, center)) continue;
    if (segmentIntersectsAABB(center, focal.center, bl)) return "poor";
  }
  return rating;
}

function evaluatePosition(
  center: Point,
  focals: FocalPoint[],
  blockers: AABB[],
  mustSee: string[]
): { sightlines: Record<string, SightRating>; worst: SightRating | null; mustSeeViolation: boolean } {
  const sightlines: Record<string, SightRating> = {};
  let worst: SightRating | null = null;
  let mustSeeViolation = false;
  for (const focal of focals) {
    const r = scoreSightline(center, focal, blockers);
    sightlines[focal.id] = r;
    worst = worst == null ? r : worse(worst, r);
    if (mustSee.includes(focal.id) && r === "poor") mustSeeViolation = true;
  }
  return { sightlines, worst, mustSeeViolation };
}

export function tableFootprint(center: Point, span: number, chairZone: number): AABB {
  const half = span / 2 + Math.max(0, chairZone);
  return { minX: center.x - half, minY: center.y - half, maxX: center.x + half, maxY: center.y + half };
}

export function footprintWithinRoom(room: Point[], center: Point, span: number, chairZone: number): boolean {
  return footprintInside(room, center, span / 2 + Math.max(0, chairZone));
}

export type TableOverride = { x: number; y: number; rotation: number };

export type FloorPlanInput = {
  room: RoomOutline | null;
  blockers: AABB[];
  focals: FocalPoint[];
  tables: CalcTable[];
  availableCount: number;
  benchSeats: number;
  settings: CalcSettings;
  overrides?: Record<number, TableOverride>;
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

  const maxSpan = tables.length ? Math.max(...tables.map(tableSpan)) : 1.1;
  const cellSize = round(maxSpan + 2 * Math.max(0, settings.chairZone));

  const cells = generateCells(roomPts, blockers, cellSize, settings.aisleWidth);

  const ordered = cells
    .map((c, i) => {
      const mustSeeOk = settings.mustSee.every((id) => {
        const focal = focals.find((f) => f.id === id);
        return focal ? scoreSightline(c, focal, blockers) !== "poor" : true;
      });
      return { c, i, mustSeeOk };
    })
    .sort((a, b) => (a.mustSeeOk === b.mustSeeOk ? a.i - b.i : a.mustSeeOk ? -1 : 1));

  const n = Math.min(tables.length, ordered.length);
  const placements: TablePlacement[] = [];
  for (let k = 0; k < n; k++) {
    const t = tables[k];
    const ov = overrides[t.mappingId];
    const center = ov ? { x: ov.x, y: ov.y } : ordered[k].c;
    const { sightlines, worst, mustSeeViolation } = evaluatePosition(center, focals, blockers, settings.mustSee);
    const dia = t.shape === "round" ? (t.diameter && t.diameter > 0 ? t.diameter : 1.1) : 0;
    const wdt = t.shape === "round" ? dia : t.width && t.width > 0 ? t.width : 1.2;
    const len = t.shape === "round" ? dia : t.length && t.length > 0 ? t.length : 0.7;
    placements.push({
      mappingId: t.mappingId,
      tableId: t.tableId,
      name: t.name,
      shape: t.shape,
      x: round(center.x),
      y: round(center.y),
      rotation: ov ? round(ov.rotation) : 0,
      span: round(tableSpan(t)),
      width: round(wdt),
      length: round(len),
      diameter: round(dia),
      baseSeats: t.baseSeats,
      extraChairs: t.extraChairs,
      chairLayout: t.chairLayout,
      isManual: !!t.isManual,
      sightlines,
      worstRating: worst,
      mustSeeViolation,
    });
  }

  const unplaced = tables.slice(n);

  if (tables.length > availableCount) {
    warnings.push({
      level: "error",
      message: `${tables.length} confirmed tables exceed ${availableCount} available table${availableCount === 1 ? "" : "s"}.`,
    });
  }
  if (unplaced.length > 0) {
    warnings.push({
      level: "warn",
      message: `Only ${n} of ${tables.length} tables fit — ${unplaced.length} could not be placed.`,
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

  const foots = placements.map((p) => tableFootprint({ x: p.x, y: p.y }, p.span, settings.chairZone));
  let outside = 0;
  let blockedTables = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (!footprintWithinRoom(roomPts, { x: p.x, y: p.y }, p.span, settings.chairZone)) outside++;
    if (blockers.some((bl) => aabbOverlap(foots[i], bl))) blockedTables++;
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
  const occupied = placements.reduce((sum, p) => sum + (p.span + 2 * settings.chairZone) ** 2, 0);

  return {
    placements,
    unplaced,
    cellsAvailable: cells.length,
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
