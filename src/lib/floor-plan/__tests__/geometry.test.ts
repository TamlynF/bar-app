import { describe, it, expect } from "vitest";
import {
  clamp,
  snap,
  round,
  polygonBounds,
  defaultRoomOutline,
  polygonArea,
  pointInPolygon,
  screenToWorld,
  facingToVector,
  rectCorners,
  rotatePoint,
  rotatedRectCorners,
  doorClearancePolygon,
  benchSeatPositions,
} from "@/lib/floor-plan/geometry";

describe("clamp", () => {
  it("bounds values to the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("snap", () => {
  it("snaps to the nearest step", () => {
    expect(snap(0.34, 0.1)).toBeCloseTo(0.3);
    expect(snap(0.36, 0.1)).toBeCloseTo(0.4);
    expect(snap(1.23, 0.5)).toBeCloseTo(1.0);
  });
  it("returns the value unchanged for a non-positive step", () => {
    expect(snap(1.23, 0)).toBe(1.23);
  });
});

describe("round", () => {
  it("removes float fuzz", () => {
    expect(round(0.1 + 0.2)).toBe(0.3);
    expect(round(1.005, 2)).toBeCloseTo(1.0);
  });
});

describe("polygonBounds", () => {
  it("returns a zero box for empty input", () => {
    expect(polygonBounds([])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      length: 0,
    });
  });
  it("computes the bounding box of an L-shape", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(polygonBounds(pts)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 4,
      maxY: 3,
      width: 4,
      length: 3,
    });
  });
});

describe("defaultRoomOutline", () => {
  it("makes a rectangle anchored at the origin", () => {
    const r = defaultRoomOutline(6, 4);
    expect(r.width).toBe(6);
    expect(r.length).toBe(4);
    expect(r.points).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 4 },
    ]);
  });
  it("never produces negative dimensions", () => {
    const r = defaultRoomOutline(-3, -1);
    expect(r.width).toBe(0);
    expect(r.length).toBe(0);
  });
});

describe("polygonArea", () => {
  it("computes a rectangle's area regardless of winding", () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(cw)).toBe(12);
    expect(polygonArea([...cw].reverse())).toBe(12);
  });
  it("returns 0 for degenerate polygons", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
});

describe("pointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ];
  it("detects interior points", () => {
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true);
  });
  it("rejects exterior points", () => {
    expect(pointInPolygon({ x: 5, y: 2 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 2 }, square)).toBe(false);
  });
  it("handles a concave (L-shaped) polygon's notch", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(pointInPolygon({ x: 1, y: 3 }, l)).toBe(true); // inside the leg
    expect(pointInPolygon({ x: 3, y: 3 }, l)).toBe(false); // in the cut-out notch
  });
});

describe("screenToWorld", () => {
  const rect = { left: 100, top: 50, width: 600, height: 400 };
  it("maps the top-left corner to the origin", () => {
    expect(screenToWorld(100, 50, rect, 12, 8)).toEqual({ x: 0, y: 0 });
  });
  it("maps the centre to the middle of the room", () => {
    expect(screenToWorld(400, 250, rect, 12, 8)).toEqual({ x: 6, y: 4 });
  });
  it("guards against a zero-size element", () => {
    expect(
      screenToWorld(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 12, 8)
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("facingToVector", () => {
  it("points up at 0 degrees", () => {
    const v = facingToVector(0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-1);
  });
  it("points right at 90 degrees", () => {
    const v = facingToVector(90);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });
  it("points down at 180 degrees", () => {
    const v = facingToVector(180);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });
});

describe("rectCorners", () => {
  it("returns clockwise corners from the top-left", () => {
    expect(rectCorners(1, 2, 3, 4)).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 6 },
      { x: 1, y: 6 },
    ]);
  });
});

describe("rotatePoint", () => {
  it("is a no-op at 0 degrees", () => {
    expect(rotatePoint({ x: 3, y: 5 }, { x: 0, y: 0 }, 0)).toEqual({ x: 3, y: 5 });
  });
  it("rotates 90° clockwise about the origin (y-down)", () => {
    expect(rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90)).toEqual({ x: 0, y: 1 });
  });
  it("rotates 180° about a centre", () => {
    expect(rotatePoint({ x: 2, y: 2 }, { x: 1, y: 1 }, 180)).toEqual({ x: 0, y: 0 });
  });
});

describe("rotatedRectCorners", () => {
  it("matches rectCorners at 0 degrees", () => {
    expect(rotatedRectCorners(0, 0, 2, 1, 0)).toEqual(rectCorners(0, 0, 2, 1));
  });
  it("rotates a 2x1 rect 90° about its centre", () => {
    const c = rotatedRectCorners(0, 0, 2, 1, 90);
    const xs = c.map((p) => p.x).sort((a, b) => a - b);
    const ys = c.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0.5);
    expect(xs[3]).toBeCloseTo(1.5);
    expect(ys[0]).toBeCloseTo(-0.5);
    expect(ys[3]).toBeCloseTo(1.5);
  });
});

describe("doorClearancePolygon", () => {
  it("sweeps downward for a door facing 180°", () => {
    const poly = doorClearancePolygon({ x: 5, y: 0 }, 180, 1, 1);
    const xs = poly.map((p) => p.x).sort((a, b) => a - b);
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(4.5);
    expect(xs[3]).toBeCloseTo(5.5);
    expect(ys[0]).toBeCloseTo(0);
    expect(ys[3]).toBeCloseTo(1);
  });
  it("sweeps rightward for a door facing 90°", () => {
    const poly = doorClearancePolygon({ x: 0, y: 3 }, 90, 2, 1.5);
    const xs = poly.map((p) => p.x).sort((a, b) => a - b);
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0);
    expect(xs[3]).toBeCloseTo(1.5);
    expect(ys[0]).toBeCloseTo(2);
    expect(ys[3]).toBeCloseTo(4);
  });
});

describe("benchSeatPositions", () => {
  it("returns one centred seat for a single-seat bench", () => {
    const pts = benchSeatPositions(0, 0, 2, 0.5, 0, 1);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBeCloseTo(1);
  });
  it("spaces seats along the longer (horizontal) axis", () => {
    const pts = benchSeatPositions(0, 0, 3, 0.5, 0, 3);
    expect(pts).toHaveLength(3);
    expect(pts.map((p) => p.x)).toEqual([0.5, 1.5, 2.5]);
    expect(pts.every((p) => p.y === 0)).toBe(true);
  });
  it("returns nothing for zero seats", () => {
    expect(benchSeatPositions(0, 0, 2, 0.5, 0, 0)).toEqual([]);
  });
});
