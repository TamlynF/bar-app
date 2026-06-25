import { describe, it, expect } from "vitest";
import {
  tableSpan,
  aabbOverlap,
  segmentIntersectsAABB,
  generateCells,
  scoreSightline,
  computeFloorPlan,
  buildBlockers,
  focalPointsFrom,
  type CalcTable,
  type FocalPoint,
  type AABB,
} from "@/lib/floor-plan/calculator";
import type { Fixture, RoomOutline } from "@/lib/floor-plan/types";

const RECT_ROOM: RoomOutline = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 },
  ],
  width: 10,
  length: 8,
};

const roundTable = (mappingId: number): CalcTable => ({
  mappingId,
  tableId: mappingId,
  name: `T${mappingId}`,
  shape: "round",
  diameter: 0.8,
  width: null,
  length: null,
  baseSeats: 4,
  extraChairs: 0,
  chairLayout: null,
});

describe("tableSpan", () => {
  it("uses diameter for round, falling back to a default", () => {
    expect(tableSpan({ shape: "round", diameter: 1.2, width: null, length: null })).toBe(1.2);
    expect(tableSpan({ shape: "round", diameter: null, width: null, length: null })).toBe(1.1);
  });
  it("uses the longer side for rectangles", () => {
    expect(tableSpan({ shape: "rect", diameter: null, width: 1.6, length: 0.8 })).toBe(1.6);
  });
});

describe("aabbOverlap", () => {
  const a: AABB = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
  it("detects overlap and separation", () => {
    expect(aabbOverlap(a, { minX: 1, minY: 1, maxX: 3, maxY: 3 })).toBe(true);
    expect(aabbOverlap(a, { minX: 3, minY: 3, maxX: 4, maxY: 4 })).toBe(false);
  });
});

describe("segmentIntersectsAABB", () => {
  const box: AABB = { minX: 2, minY: 2, maxX: 4, maxY: 4 };
  it("detects a crossing segment", () => {
    expect(segmentIntersectsAABB({ x: 0, y: 3 }, { x: 6, y: 3 }, box)).toBe(true);
  });
  it("rejects a segment that misses the box", () => {
    expect(segmentIntersectsAABB({ x: 0, y: 0 }, { x: 0, y: 6 }, box)).toBe(false);
  });
});

describe("generateCells", () => {
  it("packs a clear rectangular room in a staggered grid", () => {
    const cells = generateCells(RECT_ROOM.points, [], 2, 0);
    expect(cells.length).toBe(18); // rows of 5/4/5/4
  });
  it("drops cells that collide with a blocker", () => {
    const blocker: AABB = { minX: 0, minY: 0, maxX: 10, maxY: 2.5 }; // whole top strip
    const clear = generateCells(RECT_ROOM.points, [], 2, 0);
    const blocked = generateCells(RECT_ROOM.points, [blocker], 2, 0);
    expect(blocked.length).toBeLessThan(clear.length);
  });
  it("returns nothing for a degenerate room", () => {
    expect(generateCells([{ x: 0, y: 0 }], [], 2, 0)).toEqual([]);
  });
});

describe("scoreSightline", () => {
  const stage: FocalPoint = { id: "s", type: "stage", label: "Stage", center: { x: 5, y: 0 }, facing: 180 };
  it("rates a close, head-on viewer as good", () => {
    expect(scoreSightline({ x: 5, y: 4 }, stage, [])).toBe("good");
  });
  it("rates a viewer behind the focal as poor (bad angle)", () => {
    const facingAway: FocalPoint = { ...stage, facing: 0 };
    expect(scoreSightline({ x: 5, y: 4 }, facingAway, [])).toBe("poor");
  });
  it("rates a very distant viewer as poor", () => {
    const far: FocalPoint = { id: "p", type: "projector", label: "P", center: { x: 0, y: 0 }, facing: null };
    expect(scoreSightline({ x: 20, y: 0 }, far, [])).toBe("poor");
  });
  it("returns poor when a blocker sits on the line of sight", () => {
    const blocker: AABB = { minX: 2, minY: 1, maxX: 8, maxY: 3 };
    expect(scoreSightline({ x: 5, y: 6 }, stage, [blocker])).toBe("poor");
  });
});

describe("focalPointsFrom / buildBlockers", () => {
  const fixtures: Fixture[] = [
    { id: "fx1", type: "stage", label: "Stage", shape: "rect", x: 3, y: 0, width: 4, length: 1, facing: 180, rotation: 0 },
    { id: "fx2", type: "tv", label: "TV", shape: "rect", x: 0, y: 3, width: 1, length: 0.1, facing: 90, rotation: 0 },
    { id: "fx3", type: "bar", label: "Bar", shape: "rect", x: 8, y: 0, width: 2, length: 1, facing: null, rotation: 0 },
  ];
  it("includes stage/tv as focal points but not the bar", () => {
    const f = focalPointsFrom(fixtures);
    expect(f.map((x) => x.id).sort()).toEqual(["fx1", "fx2"]);
  });
  it("treats stage and bar as blockers (not the tv)", () => {
    const blockers = buildBlockers([], fixtures, []);
    expect(blockers).toHaveLength(2); // stage + bar
  });
  it("adds a door keep-clear blocker on top of the door footprint", () => {
    const blockers = buildBlockers([], [], [
      { id: "d", kind: "door", label: "Door", x: 4, y: 0, width: 0.9, length: 0.15, facing: 180, rotation: 0 },
    ]);
    expect(blockers).toHaveLength(2); // door rect + clearance
  });
});

describe("computeFloorPlan", () => {
  const settings = { chairZone: 0.3, aisleWidth: 0.9, mustSee: [] as string[] };

  it("flags a missing room outline and places nothing", () => {
    const res = computeFloorPlan({
      room: null,
      blockers: [],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 10,
      benchSeats: 0,
      settings,
    });
    expect(res.placements).toHaveLength(0);
    expect(res.unplaced).toHaveLength(1);
    expect(res.warnings.some((w) => w.level === "error")).toBe(true);
  });

  it("places confirmed tables and totals their seats (plus benches)", () => {
    const tables = [roundTable(1), roundTable(2), roundTable(3), roundTable(4)];
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables,
      availableCount: 10,
      benchSeats: 6,
      settings,
    });
    expect(res.stats.tablesPlaced).toBe(4);
    expect(res.stats.totalSeats).toBe(4 * 4 + 6);
    expect(res.stats.mustSeeCompliant).toBe(true);
    expect(res.stats.utilisation).toBeGreaterThan(0);
  });

  it("errors when confirmed tables exceed available tables", () => {
    const tables = [roundTable(1), roundTable(2), roundTable(3)];
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables,
      availableCount: 2,
      benchSeats: 0,
      settings,
    });
    expect(res.warnings.some((w) => w.level === "error" && /exceed/.test(w.message))).toBe(true);
  });

  it("raises a must-see violation when a focal cannot be seen", () => {
    const focal: FocalPoint = { id: "f1", type: "stage", label: "Stage", center: { x: 5, y: 0 }, facing: 0 }; // faces away
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [focal],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings: { ...settings, mustSee: ["f1"] },
    });
    expect(res.stats.mustSeeCompliant).toBe(false);
    expect(res.warnings.some((w) => w.level === "error" && /cannot see/.test(w.message))).toBe(true);
  });

  it("warns when the aisle is below the WCAG minimum", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings: { ...settings, aisleWidth: 0.5 },
    });
    expect(res.warnings.some((w) => /WCAG/.test(w.message))).toBe(true);
  });

  it("applies a manual override to a table's position", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      overrides: { 1: { x: 6.5, y: 4.2, rotation: 30 } },
    });
    const p = res.placements.find((x) => x.mappingId === 1)!;
    expect(p.x).toBe(6.5);
    expect(p.y).toBe(4.2);
    expect(p.rotation).toBe(30);
  });

  it("warns when a nudged table is pushed outside the room", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      overrides: { 1: { x: 9.9, y: 7.9, rotation: 0 } },
    });
    expect(res.warnings.some((w) => /outside the room/.test(w.message))).toBe(true);
  });

  it("warns when two nudged tables overlap", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1), roundTable(2)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      overrides: { 1: { x: 5, y: 4, rotation: 0 }, 2: { x: 5.1, y: 4, rotation: 0 } },
    });
    expect(res.warnings.some((w) => /tables overlap/.test(w.message))).toBe(true);
  });

  it("warns when a nudged table overlaps a blocker", () => {
    const blocker = { minX: 4, minY: 3, maxX: 6, maxY: 5 };
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [blocker],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      overrides: { 1: { x: 5, y: 4, rotation: 0 } },
    });
    expect(res.warnings.some((w) => /obstacle, fixture or door/.test(w.message))).toBe(true);
  });
});
