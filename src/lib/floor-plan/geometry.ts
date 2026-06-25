// Pure geometry helpers for the floor-plan tools. No DOM, no React — unit-tested.
import type { Point, RoomOutline } from "./types";

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  length: number;
};

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Snap a value to the nearest multiple of `step` (defaults to 0.1 m). */
export function snap(value: number, step = 0.1): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Round to a fixed number of decimal places, avoiding float fuzz (e.g. 0.30000004). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r; // normalise -0 → 0
}

/** Axis-aligned bounding box of a set of points. Empty input → a zero box. */
export function polygonBounds(points: Point[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, length: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, length: maxY - minY };
}

/** A rectangular room outline of `width` x `length` metres anchored at the origin. */
export function defaultRoomOutline(width: number, length: number): RoomOutline {
  const w = Math.max(0, round(width));
  const l = Math.max(0, round(length));
  return {
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: l },
      { x: 0, y: l },
    ],
    width: w,
    length: l,
  };
}

/** Signed area of a polygon (shoelace). Positive = clockwise in screen coords. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Ray-casting point-in-polygon test. Points on the edge count as inside. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Convert a screen/client coordinate to world metres for an SVG whose viewBox is
 * `0 0 viewWidth viewLength` and which renders with NO letter-boxing (the
 * container's aspect ratio matches the viewBox). `rect` is the element's
 * bounding box in client pixels.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewWidth: number,
  viewLength: number
): Point {
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * viewWidth,
    y: ((clientY - rect.top) / rect.height) * viewLength,
  };
}

/** Unit vector for a `facing` heading in degrees (0 = up / -y, clockwise). */
export function facingToVector(facingDegrees: number): Point {
  const rad = (facingDegrees * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/** The four corners of an axis-aligned rectangle, clockwise from the top-left. */
export function rectCorners(x: number, y: number, width: number, length: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + length },
    { x, y: y + length },
  ];
}

/** Rotate a point about a centre by `degrees` (clockwise in screen coords, +y down). */
export function rotatePoint(p: Point, center: Point, degrees: number): Point {
  if (!degrees) return { x: round(p.x), y: round(p.y) };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: round(center.x + dx * cos - dy * sin),
    y: round(center.y + dx * sin + dy * cos),
  };
}

/** The four corners of a rectangle rotated `degrees` about its own centre. */
export function rotatedRectCorners(
  x: number,
  y: number,
  width: number,
  length: number,
  degrees: number
): Point[] {
  const center = { x: x + width / 2, y: y + length / 2 };
  return rectCorners(x, y, width, length).map((c) => rotatePoint(c, center, degrees));
}

/**
 * Keep-clear polygon swept in front of a door. The door's opening width is its
 * longer side; the clearance extends `depth` metres in the facing direction.
 * Returns a 4-point polygon. Works for any facing angle.
 */
export function doorClearancePolygon(
  center: Point,
  facingDegrees: number,
  doorWidth: number,
  depth: number
): Point[] {
  const f = facingToVector(facingDegrees);
  const perp = { x: -f.y, y: f.x }; // 90° to facing
  const hw = doorWidth / 2;
  const a = { x: center.x + perp.x * hw, y: center.y + perp.y * hw };
  const b = { x: center.x - perp.x * hw, y: center.y - perp.y * hw };
  const c = { x: b.x + f.x * depth, y: b.y + f.y * depth };
  const d = { x: a.x + f.x * depth, y: a.y + f.y * depth };
  return [
    { x: round(a.x), y: round(a.y) },
    { x: round(b.x), y: round(b.y) },
    { x: round(c.x), y: round(c.y) },
    { x: round(d.x), y: round(d.y) },
  ];
}

/**
 * Evenly spaced seat centres along the facing-side edge of a bench's bounding
 * box, inset slightly from the ends. Used to render and count bench seating.
 */
export function benchSeatPositions(
  x: number,
  y: number,
  width: number,
  length: number,
  facingDegrees: number | null,
  seats: number
): Point[] {
  if (seats <= 0) return [];
  // Seats run along the longer axis; place them on the facing-side edge.
  const horizontal = width >= length;
  const along = horizontal ? width : length;
  const result: Point[] = [];
  for (let i = 0; i < seats; i++) {
    const t = seats === 1 ? 0.5 : (i + 0.5) / seats;
    const pos = t * along;
    if (horizontal) {
      // Facing up (<90 or >270) → seats sit along the top edge, else the bottom.
      const onTop = facingDegrees == null || facingDegrees <= 45 || facingDegrees >= 315;
      result.push({ x: round(x + pos), y: round(onTop ? y : y + length) });
    } else {
      const onLeft = facingDegrees != null && facingDegrees > 180;
      result.push({ x: round(onLeft ? x : x + width), y: round(y + pos) });
    }
  }
  return result;
}
