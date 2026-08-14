import type { Point, RoomOutline } from "./types";

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  length: number;
};

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function snap(value: number, step = 0.1): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r; // normalise -0 → 0
}

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

export function facingToVector(facingDegrees: number): Point {
  const rad = (facingDegrees * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

export function rectCorners(x: number, y: number, width: number, length: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + length },
    { x, y: y + length },
  ];
}

export function rotateAbout(p: Point, center: Point, degrees: number): Point {
  if (!degrees) return { x: p.x, y: p.y };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function rotatePoint(p: Point, center: Point, degrees: number): Point {
  const r = rotateAbout(p, center, degrees);
  return { x: round(r.x), y: round(r.y) };
}

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

export type BoxResize = {
  dx: number; // -1 shrinks/grows from the min-x edge, +1 the max-x edge, 0 leaves x alone
  dy: number;
  rotation: number;
  width: number;
  length: number;
  minSize: number;
  circular?: boolean; // keep width and length equal
};

export function resizeRotatedBox(
  anchor: Point,
  pointer: Point,
  opts: BoxResize
): { x: number; y: number; width: number; length: number } {
  const { dx, dy, rotation, minSize } = opts;
  const local = rotateAbout(pointer, anchor, -rotation);
  let width = dx === 0 ? opts.width : Math.max(minSize, Math.abs(local.x - anchor.x));
  let length = dy === 0 ? opts.length : Math.max(minSize, Math.abs(local.y - anchor.y));
  if (opts.circular) {
    const d = dx !== 0 && dy !== 0 ? Math.max(width, length) : dx !== 0 ? width : length;
    width = d;
    length = d;
  }
  const centre = rotateAbout(
    { x: anchor.x + (dx * width) / 2, y: anchor.y + (dy * length) / 2 },
    anchor,
    rotation
  );
  return {
    x: round(centre.x - width / 2),
    y: round(centre.y - length / 2),
    width: round(width),
    length: round(length),
  };
}

// Separating-axis test. Exact for convex shapes; for a concave polygon it can only
// err towards reporting an overlap, which is the safe direction for placement.
export function convexPolygonsOverlap(a: Point[], b: Point[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const eps = 1e-9;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len < eps) continue;
      const nx = -(p2.y - p1.y) / len;
      const ny = (p2.x - p1.x) / len;
      let aMin = Infinity;
      let aMax = -Infinity;
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const p of a) {
        const d = p.x * nx + p.y * ny;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of b) {
        const d = p.x * nx + p.y * ny;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      if (aMax <= bMin + eps || bMax <= aMin + eps) return false;
    }
  }
  return true;
}

export function resizePolygon(
  points: Point[],
  anchor: Point,
  pointer: Point,
  opts: { dx: number; dy: number; width: number; length: number; minSize: number }
): Point[] {
  const { dx, dy, width, length, minSize } = opts;
  const newWidth = dx === 0 ? width : Math.max(minSize, Math.abs(pointer.x - anchor.x));
  const newLength = dy === 0 ? length : Math.max(minSize, Math.abs(pointer.y - anchor.y));
  const sx = dx === 0 || width <= 0 ? 1 : newWidth / width;
  const sy = dy === 0 || length <= 0 ? 1 : newLength / length;
  return points.map((p) => ({
    x: round(anchor.x + (p.x - anchor.x) * sx),
    y: round(anchor.y + (p.y - anchor.y) * sy),
  }));
}

export function rotatePolygonAbout(points: Point[], centre: Point, degrees: number): Point[] {
  return points.map((p) => rotatePoint(p, centre, degrees));
}

export function rotatedEllipseBounds(
  x: number,
  y: number,
  width: number,
  length: number,
  degrees: number
): Bounds {
  const a = width / 2;
  const b = length / 2;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hx = Math.hypot(a * cos, b * sin);
  const hy = Math.hypot(a * sin, b * cos);
  const cx = x + a;
  const cy = y + b;
  return { minX: cx - hx, minY: cy - hy, maxX: cx + hx, maxY: cy + hy, width: hx * 2, length: hy * 2 };
}

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

export function benchSeatPositions(
  x: number,
  y: number,
  width: number,
  length: number,
  facingDegrees: number | null,
  seats: number
): Point[] {
  if (seats <= 0) return [];
  const horizontal = width >= length;
  const along = horizontal ? width : length;
  const result: Point[] = [];
  for (let i = 0; i < seats; i++) {
    const t = seats === 1 ? 0.5 : (i + 0.5) / seats;
    const pos = t * along;
    if (horizontal) {
      const onTop = facingDegrees == null || facingDegrees <= 45 || facingDegrees >= 315;
      result.push({ x: round(x + pos), y: round(onTop ? y : y + length) });
    } else {
      const onLeft = facingDegrees != null && facingDegrees > 180;
      result.push({ x: round(onLeft ? x : x + width), y: round(y + pos) });
    }
  }
  return result;
}
