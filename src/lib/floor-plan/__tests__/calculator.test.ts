import { describe, it, expect } from "vitest";
import {
  tableSlot,
  orientSlot,
  shapeBounds,
  shapeOutline,
  blockerHitsRect,
  aabbOverlap,
  segmentIntersectsAABB,
  sightlineBlocked,
  explainSightline,
  describeSightIssue,
  seatViewsFor,
  buildAnchors,
  packAtAnchors,
  findFreeSlot,
  scoreSightline,
  computeFloorPlan,
  buildBlockers,
  focalPointsFrom,
  type CalcTable,
  type FocalPoint,
  type AABB,
  type Blocker,
} from "@/lib/floor-plan/calculator";
import type { Feature, Fixture, Obstacle, RoomOutline } from "@/lib/floor-plan/types";

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

describe("tableSlot", () => {
  it("wraps a round table in a square chair zone", () => {
    expect(tableSlot({ shape: "round", diameter: 1.2, width: null, length: null }, 0.5)).toEqual({ w: 2.2, l: 2.2 });
  });
  it("keeps a rectangle rectangular instead of squaring it off", () => {
    expect(tableSlot({ shape: "rect", diameter: null, width: 0.7, length: 1.4 }, 0.5)).toEqual({ w: 1.7, l: 2.4 });
  });
  it("falls back to defaults for missing dimensions", () => {
    expect(tableSlot({ shape: "round", diameter: null, width: null, length: null }, 0)).toEqual({ w: 1.1, l: 1.1 });
  });
  it("coerces numeric dimensions arriving as strings", () => {
    const t = { shape: "rect", diameter: null, width: "0.7", length: "1.4" } as unknown as CalcTable;
    expect(tableSlot(t, 0.5)).toEqual({ w: 1.7, l: 2.4 });
  });
});

describe("orientSlot", () => {
  it("leaves an unrotated slot alone", () => {
    expect(orientSlot({ w: 1.7, l: 2.4 }, 0)).toEqual({ w: 1.7, l: 2.4 });
    expect(orientSlot({ w: 1.7, l: 2.4 }, 180)).toEqual({ w: 1.7, l: 2.4 });
  });
  it("swaps the axes for a quarter turn", () => {
    expect(orientSlot({ w: 1.7, l: 2.4 }, 90)).toEqual({ w: 2.4, l: 1.7 });
    expect(orientSlot({ w: 1.7, l: 2.4 }, 270)).toEqual({ w: 2.4, l: 1.7 });
  });
});

describe("shapeBounds", () => {
  it("returns the plain box when there is no rotation", () => {
    expect(shapeBounds({ shape: "rect", x: 1, y: 2, width: 4, length: 2, rotation: 0 })).toEqual({
      minX: 1,
      minY: 2,
      maxX: 5,
      maxY: 4,
    });
  });
  it("swaps the extents of a quarter-turned rectangle", () => {
    const b = shapeBounds({ shape: "rect", x: 0, y: 0, width: 4, length: 2, rotation: 90 });
    expect(b.maxX - b.minX).toBeCloseTo(2);
    expect(b.maxY - b.minY).toBeCloseTo(4);
  });
  it("grows a diagonally rotated rectangle's box", () => {
    const b = shapeBounds({ shape: "rect", x: 0, y: 0, width: 4, length: 2, rotation: 45 });
    expect(b.maxX - b.minX).toBeCloseTo(Math.SQRT2 * 3, 1);
  });
  it("keeps a rotated circle the same size", () => {
    const b = shapeBounds({ shape: "circle", x: 0, y: 0, width: 0.6, length: 0.6, rotation: 35 });
    expect(b.maxX - b.minX).toBeCloseTo(0.6);
    expect(b.maxY - b.minY).toBeCloseTo(0.6);
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

describe("buildAnchors", () => {
  it("covers the room bounding box at the given pitch", () => {
    expect(buildAnchors(RECT_ROOM.points, 2)).toHaveLength(30); // 6 columns x 5 rows
  });
  it("shifts the whole lattice by the origin offset", () => {
    const shifted = buildAnchors(RECT_ROOM.points, 2, 0.5, 0.5);
    expect(shifted[0]).toEqual({ x: 0.5, y: 0.5 });
  });
  it("returns nothing for a degenerate room", () => {
    expect(buildAnchors([{ x: 0, y: 0 }], 2)).toEqual([]);
  });
});

describe("packAtAnchors", () => {
  const anchors = buildAnchors(RECT_ROOM.points, 0.5);
  const slot = { w: 2, l: 2 };

  it("keeps placed footprints an aisle apart", () => {
    const items = [1, 2, 3].map((id) => ({ id, slot }));
    const run = packAtAnchors(RECT_ROOM.points, [], anchors, items, [], 1);
    expect(run.positions.size).toBe(3);
    const pts = [...run.positions.values()];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const apart = Math.max(Math.abs(pts[i].x - pts[j].x), Math.abs(pts[i].y - pts[j].y));
        expect(apart).toBeGreaterThanOrEqual(2 + 1 - 1e-6);
      }
    }
  });

  it("refuses anchors that overlap a blocker", () => {
    const blocker: AABB = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
    const run = packAtAnchors(RECT_ROOM.points, [blocker], anchors, [{ id: 1, slot }], [], 0);
    expect(run.positions.size).toBe(0);
  });

  it("packs a small table into a gap too tight for a large one", () => {
    const narrow: RoomOutline = {
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 0, y: 3 },
      ],
      width: 3,
      length: 3,
    };
    const fine = buildAnchors(narrow.points, 0.25);
    expect(packAtAnchors(narrow.points, [], fine, [{ id: 1, slot: { w: 4, l: 4 } }], [], 0).positions.size).toBe(0);
    expect(packAtAnchors(narrow.points, [], fine, [{ id: 1, slot: { w: 1, l: 2.5 } }], [], 0).positions.size).toBe(1);
  });
});

describe("findFreeSlot", () => {
  it("finds a spot in an empty room and none in a full one", () => {
    const slot = { w: 2, l: 2 };
    expect(findFreeSlot(RECT_ROOM.points, [], [], slot, 0.9)).not.toBeNull();
    const full: AABB = { minX: -1, minY: -1, maxX: 11, maxY: 9 };
    expect(findFreeSlot(RECT_ROOM.points, [], [full], slot, 0.9)).toBeNull();
  });
});

describe("scoreSightline", () => {
  const stage: FocalPoint = { id: "s", type: "stage", label: "Stage", center: { x: 5, y: 0 }, facing: 180, height: 1.9 };
  it("rates a close, head-on viewer as good", () => {
    expect(scoreSightline({ x: 5, y: 4 }, stage, [])).toBe("good");
  });
  it("rates a viewer behind the focal as poor (bad angle)", () => {
    const facingAway: FocalPoint = { ...stage, facing: 0 };
    expect(scoreSightline({ x: 5, y: 4 }, facingAway, [])).toBe("poor");
  });
  it("rates a very distant viewer as poor", () => {
    const far: FocalPoint = { id: "p", type: "projector", label: "P", center: { x: 0, y: 0 }, facing: null, height: 2.2 };
    expect(scoreSightline({ x: 20, y: 0 }, far, [])).toBe("poor");
  });
  it("returns poor when a blocker of unknown height sits on the line of sight", () => {
    const blocker: AABB = { minX: 2, minY: 1, maxX: 8, maxY: 3 };
    expect(scoreSightline({ x: 5, y: 6 }, stage, [blocker])).toBe("poor");
  });
});

describe("sightlineBlocked", () => {
  const viewer = { x: 5, y: 6 };
  const screen: FocalPoint = { id: "p", type: "projector", label: "Screen", center: { x: 5, y: 0 }, facing: 180, height: 2.2 };
  const inTheWay = { minX: 2, minY: 1, maxX: 8, maxY: 3 };

  it("blocks when the obstacle's height is unknown", () => {
    expect(sightlineBlocked(viewer, screen, inTheWay)).toBe(true);
  });
  it("lets the view pass over a bar counter", () => {
    expect(sightlineBlocked(viewer, screen, { ...inTheWay, height: 1.1 })).toBe(false);
  });
  it("still blocks on a full-height wall", () => {
    expect(sightlineBlocked(viewer, screen, { ...inTheWay, height: 2.4 })).toBe(true);
  });
  it("blocks a low target that the eye line drops below", () => {
    const lowTv: FocalPoint = { ...screen, height: 0.4 };
    expect(sightlineBlocked(viewer, lowTv, { ...inTheWay, height: 1.1 })).toBe(true);
  });
  it("ignores an obstacle the viewer or focal sits inside", () => {
    const around = { minX: 0, minY: 0, maxX: 10, maxY: 10, height: 3 };
    expect(sightlineBlocked(viewer, screen, around)).toBe(false);
  });
  it("never blocks a zero-height keep-clear zone", () => {
    expect(sightlineBlocked(viewer, screen, { ...inTheWay, height: 0 })).toBe(false);
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

describe("blockerHitsRect", () => {
  // A 4 x 1 bar spun 45 degrees: its bounding box is ~3.5 x 3.5 but the bar itself is a thin diagonal.
  const bar = { shape: "rect" as const, x: 2, y: 4, width: 4, length: 1, rotation: 45 };
  const blocker: Blocker = { ...shapeOutline(bar).box, corners: shapeOutline(bar).corners };

  it("still blocks a table sitting on the bar itself", () => {
    expect(blockerHitsRect(blocker, { minX: 3.5, minY: 4, maxX: 4.5, maxY: 5 })).toBe(true);
  });

  it("frees the corners the bounding box used to swallow", () => {
    const corner = { minX: 2.3, minY: 5.8, maxX: 3.1, maxY: 6.2 }; // inside the box, clear of the bar
    expect(aabbOverlap(corner, blocker)).toBe(true); // the old test would have refused this spot
    expect(blockerHitsRect(blocker, corner)).toBe(false);
  });

  it("rejects anything outside the bounding box without further work", () => {
    expect(blockerHitsRect(blocker, { minX: 20, minY: 20, maxX: 21, maxY: 21 })).toBe(false);
  });

  it("falls back to the box when no rotated footprint is known", () => {
    const plain: Blocker = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    expect(blockerHitsRect(plain, { minX: 3, minY: 3, maxX: 5, maxY: 5 })).toBe(true);
  });
});

describe("explainSightline", () => {
  const screen: FocalPoint = { id: "p", type: "projector", label: "Screen", center: { x: 5, y: 0 }, facing: 180, height: 2.2 };

  it("names the obstacle that hides the focal", () => {
    const bar: Blocker = { minX: 2, minY: 1, maxX: 8, maxY: 3, height: 2.4, label: "Bar" };
    expect(explainSightline({ x: 5, y: 6 }, screen, [bar])).toEqual({
      rating: "poor",
      issue: { kind: "blocked", label: "Bar" },
    });
  });

  it("falls back to a generic name for an unlabelled obstacle", () => {
    const verdict = explainSightline({ x: 5, y: 6 }, screen, [{ minX: 2, minY: 1, maxX: 8, maxY: 3 }]);
    expect(verdict.issue).toEqual({ kind: "blocked", label: "an obstacle" });
  });

  it("reports distance when the focal is simply too far", () => {
    const far: FocalPoint = { ...screen, facing: null };
    const verdict = explainSightline({ x: 5, y: 12 }, far, []);
    expect(verdict.rating).toBe("acceptable");
    expect(verdict.issue).toEqual({ kind: "distance", metres: 12 });
  });

  it("reports the off-axis angle when that is the worse of the two", () => {
    const verdict = explainSightline({ x: 0, y: 1 }, screen, []);
    expect(verdict.issue?.kind).toBe("angle");
  });

  it("judges a screen strictly but a booth leniently at the same angle", () => {
    const booth: FocalPoint = { ...screen, type: "dj_booth", label: "DJ Booth" };
    const offToTheSide = { x: 0.5, y: 2 }; // ~65 degrees off the forward axis
    expect(explainSightline(offToTheSide, screen, []).rating).toBe("acceptable");
    expect(explainSightline(offToTheSide, booth, []).rating).toBe("good");
  });

  it("still calls a viewer behind a booth poor", () => {
    const booth: FocalPoint = { ...screen, type: "dj_booth", facing: 0 }; // faces away
    expect(explainSightline({ x: 5, y: 4 }, booth, []).rating).toBe("poor");
  });

  it("has nothing to report on a clean view", () => {
    expect(explainSightline({ x: 5, y: 4 }, screen, [])).toEqual({ rating: "good", issue: null });
  });
});

describe("describeSightIssue", () => {
  it("phrases each kind of problem", () => {
    expect(describeSightIssue({ kind: "blocked", label: "Bar" }, "DJ Booth")).toBe("DJ Booth is hidden behind Bar");
    expect(describeSightIssue({ kind: "distance", metres: 18 }, "Stage")).toBe("Stage is 18 m away");
    expect(describeSightIssue({ kind: "angle", degrees: 120 }, "TV1")).toBe("sits 120° off to the side of TV1");
    expect(describeSightIssue(null, "Stage")).toBe("can see Stage");
  });
});

describe("seatViewsFor", () => {
  const placement = {
    mappingId: 1,
    tableId: 1,
    name: "01",
    shape: "rect" as const,
    x: 5,
    y: 5,
    rotation: 0,
    width: 0.7,
    length: 1.4,
    diameter: 0,
    baseSeats: 6,
    extraChairs: 0,
    chairLayout: { mode: "bench" as const, perSide: 3 },
    isManual: false,
    sightlines: {},
    worstRating: null,
    mustSeeRating: null,
    mustSeeViolation: false,
  };
  const screen: FocalPoint = { id: "p", type: "projector", label: "Screen", center: { x: 5, y: 0 }, facing: 180, height: 2.2 };

  it("scores every seat on a bench table, not just the table centre", () => {
    expect(seatViewsFor(placement, [screen], [], 0.5)).toHaveLength(6);
  });

  it("splits the table when a wall hides the focal from one side only", () => {
    const wall: Blocker = { minX: 5.2, minY: 2, maxX: 6.5, maxY: 3, height: 2.4, label: "Wall" };
    const views = seatViewsFor(placement, [screen], [wall], 0.5);
    const poor = views.filter((v) => v.rating === "poor");
    expect(poor.length).toBeGreaterThan(0);
    expect(poor.length).toBeLessThan(views.length);
    expect(poor[0].issue).toEqual({ kind: "blocked", label: "Wall" });
    expect(poor[0].focalLabel).toBe("Screen");
  });

  it("moves the seats with the table's rotation", () => {
    const upright = seatViewsFor(placement, [screen], [], 0.5);
    const turned = seatViewsFor({ ...placement, rotation: 90 }, [screen], [], 0.5);
    expect(turned.map((s) => s.x).sort()).not.toEqual(upright.map((s) => s.x).sort());
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
    const focal: FocalPoint = { id: "f1", type: "stage", label: "Stage", center: { x: 5, y: 0 }, facing: 0, height: 1.9 }; // faces away
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [focal],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings: { ...settings, mustSee: ["f1"] },
      overrides: { 1: { x: 5, y: 4, rotation: 0 } }, // squarely behind it
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

  it("packs the loose tables around a pinned one instead of on top of it", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1), roundTable(2), roundTable(3)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      overrides: { 1: { x: 5, y: 4, rotation: 0 } },
    });
    expect(res.stats.tablesPlaced).toBe(3);
    expect(res.placements.find((p) => p.mappingId === 1)).toMatchObject({ x: 5, y: 4 });
    expect(res.warnings.some((w) => /tables overlap/.test(w.message))).toBe(false);
  });

  it("reports spare capacity for the tables still in the pool", () => {
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [roundTable(1)],
      availableCount: 5,
      benchSeats: 0,
      settings,
      spareTables: [2, 3, 4].map(roundTable),
    });
    expect(res.cellsAvailable).toBeGreaterThan(res.placements.length);
  });

  it("does not let one long table starve the short ones of space", () => {
    const long: CalcTable = {
      ...roundTable(1),
      shape: "rect",
      diameter: null,
      width: 0.7,
      length: 1.4,
      baseSeats: 6,
    };
    const short = (id: number): CalcTable => ({
      ...roundTable(id),
      shape: "rect",
      diameter: null,
      width: 0.7,
      length: 0.95,
    });
    const res = computeFloorPlan({
      room: RECT_ROOM,
      blockers: [],
      focals: [],
      tables: [long, short(2), short(3), short(4), short(5), short(6)],
      availableCount: 10,
      benchSeats: 0,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: [] },
    });
    expect(res.stats.tablesPlaced).toBe(6);
  });
});

describe("computeFloorPlan - irregular room regression", () => {
  const SLANTED_ROOM: RoomOutline = {
    width: 12.6,
    length: 7.8,
    points: [
      { x: 0, y: 6.2 },
      { x: 4.5, y: 0 },
      { x: 11.9, y: 0.2 },
      { x: 12.6, y: 7.8 },
      { x: 5.4, y: 7.8 },
      { x: 0, y: 6.2 },
    ],
  };
  const OBSTACLES: Obstacle[] = [
    { id: "ob1", label: "Pillar 1", shape: "circle", x: 5.15, y: 7.35, width: 0.6, length: 0.6, rotation: 0 },
    { id: "ob2", label: "Tree", shape: "circle", x: 11.55, y: 6.83, width: 0.8, length: 0.8, rotation: 0 },
    { id: "ob3", label: "Stairs", shape: "rect", x: 6.35, y: 0.12, width: 1, length: 1, rotation: 0 },
  ];
  const FIXTURES: Fixture[] = [
    { id: "fx1", type: "bar", label: "Bar", shape: "rect", x: 2.35, y: 1.95, width: 2.4, length: 3.2, facing: null, rotation: 35 },
    { id: "fx2", type: "projector", label: "Projector", shape: "rect", x: 3.8, y: 0.5, width: 1, length: 0.2, facing: 125, rotation: 305 },
    { id: "fx3", type: "dj_booth", label: "DJ Booth", shape: "rect", x: 7.55, y: 0.15, width: 4.3, length: 1.3, facing: 185, rotation: 2 },
    { id: "fx4", type: "tv", label: "TV1", shape: "rect", x: 7.55, y: 1.25, width: 1.2, length: 0.15, facing: 180, rotation: 0 },
    { id: "fx5", type: "tv", label: "TV2", shape: "rect", x: 3.05, y: 6.55, width: 1.2, length: 0.15, facing: 50, rotation: 235 },
  ];
  const FEATURES: Feature[] = [
    { id: "ft1", kind: "door", label: "Door", x: 2, y: 6.75, width: 0.9, length: 0.15, facing: 40, rotation: 15 },
    { id: "ft2", kind: "window", label: "Window1", x: 6.15, y: 7.68, width: 5, length: 0.2, facing: null, rotation: 0 },
    { id: "ft3", kind: "window", label: "Window2", x: 2.95, y: 7.28, width: 1.8, length: 0.1, facing: null, rotation: 17 },
    { id: "ft4", kind: "bench", label: "Bench1", x: 6.15, y: 7.3, width: 5, length: 0.4, facing: 0, rotation: 0, seats: 7 },
  ];

  const rect = (mappingId: number, name: string, length: number, baseSeats: number): CalcTable => ({
    mappingId,
    tableId: mappingId,
    name,
    shape: "rect",
    diameter: null,
    width: 0.7,
    length,
    baseSeats,
    extraChairs: 0,
    chairLayout: null,
  });

  const run = (tables: CalcTable[]) =>
    computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: buildBlockers(OBSTACLES, FIXTURES, FEATURES),
      focals: focalPointsFrom(FIXTURES),
      tables,
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: [] },
    });

  it("places all three booked tables in the slanted bar room", () => {
    const res = run([rect(1, "01", 0.95, 4), rect(2, "10", 0.95, 4), rect(3, "03", 1.4, 6)]);
    expect(res.stats.tablesPlaced).toBe(3);
    expect(res.unplaced).toHaveLength(0);
    expect(res.warnings.some((w) => /could not be placed/.test(w.message))).toBe(false);
  });

  it("keeps every placement clear of blockers and of each other", () => {
    const res = run([rect(1, "01", 0.95, 4), rect(2, "10", 0.95, 4), rect(3, "03", 1.4, 6)]);
    expect(res.warnings.some((w) => /overlap/.test(w.message))).toBe(false);
    expect(res.warnings.some((w) => /outside the room/.test(w.message))).toBe(false);
  });

  const POOL = [
    rect(1, "01", 0.95, 4),
    rect(2, "02", 0.95, 4),
    rect(3, "03", 1.4, 6),
    rect(4, "04", 1.4, 6),
    rect(5, "06", 1.4, 6),
    rect(6, "10", 0.95, 4),
  ];

  it("seats four of the six-table pool at the WCAG aisle", () => {
    expect(run(POOL).stats.tablesPlaced).toBe(4);
  });

  it("seats all five booked tables once a stage is added to the room", () => {
    const withStage: Fixture[] = [
      ...FIXTURES,
      { id: "fx6", type: "stage", label: "Stage", shape: "rect", x: 3.81, y: 0.34, width: 2, length: 1.75, facing: 125, rotation: 305, height: 0.2, viewHeight: 0.2 },
    ];
    const booked = [
      rect(78, "01", 0.95, 4),
      rect(82, "10", 0.95, 4),
      rect(83, "03", 1.4, 6),
      rect(85, "06", 1.4, 6),
      rect(86, "02", 0.95, 4),
    ];
    const blockers = buildBlockers(OBSTACLES, withStage, FEATURES);
    const res = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers,
      focals: focalPointsFrom(withStage),
      tables: booked,
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: [] },
    });
    expect(res.stats.tablesPlaced).toBe(5);
    expect(res.unplaced).toHaveLength(0);

    const asBoxes = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: blockers.map((b) => ({ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, height: b.height })),
      focals: focalPointsFrom(withStage),
      tables: booked,
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: [] },
    });
    expect(asBoxes.stats.tablesPlaced).toBe(4); // what the bounding-box test used to manage
  });

  it("seats the whole pool once the aisle stops being the binding constraint", () => {
    const res = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: buildBlockers(OBSTACLES, FIXTURES, FEATURES),
      focals: focalPointsFrom(FIXTURES),
      tables: POOL,
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0, mustSee: [] },
    });
    expect(res.stats.tablesPlaced).toBe(6);
  });

  it("turns a table sideways when that is the only way it fits", () => {
    const res = run(POOL);
    expect(res.placements.some((p) => p.rotation === 90)).toBe(true);
  });

  it("sees the projector and TV2 over the bar counter", () => {
    const res = run([rect(1, "01", 0.95, 4), rect(2, "10", 0.95, 4), rect(3, "03", 1.4, 6)]);
    for (const p of res.placements) {
      expect(p.sightlines["fx2"]).not.toBe("poor"); // projector, behind the bar in plan view
      expect(p.sightlines["fx5"]).not.toBe("poor"); // TV2, likewise
    }
  });

  it("still blocks the view when the bar is raised to full height", () => {
    const tallBar = FIXTURES.map((f) => (f.type === "bar" ? { ...f, height: 2.4 } : f));
    const res = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: buildBlockers(OBSTACLES, tallBar, FEATURES),
      focals: focalPointsFrom(tallBar),
      tables: [rect(1, "01", 0.95, 4), rect(2, "10", 0.95, 4), rect(3, "03", 1.4, 6)],
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: [] },
    });
    expect(res.placements.some((p) => p.sightlines["fx2"] === "poor")).toBe(true);
  });

  it("gives every seat a good view of the booth it sits beside", () => {
    const res = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: buildBlockers(OBSTACLES, FIXTURES, FEATURES),
      focals: focalPointsFrom(FIXTURES),
      tables: POOL,
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: ["fx3"] },
    });
    for (const p of res.placements) {
      for (const seat of p.seats) {
        expect(seat.rating).toBe("good");
      }
    }
  });

  it("scores the DJ booth against the must-see focal, not the whole venue", () => {
    const res = computeFloorPlan({
      room: SLANTED_ROOM,
      blockers: buildBlockers(OBSTACLES, FIXTURES, FEATURES),
      focals: focalPointsFrom(FIXTURES),
      tables: [rect(1, "01", 0.95, 4), rect(2, "10", 0.95, 4), rect(3, "03", 1.4, 6)],
      availableCount: 6,
      benchSeats: 7,
      settings: { chairZone: 0.5, aisleWidth: 0.9, mustSee: ["fx3"] },
    });
    expect(res.stats.mustSeeCompliant).toBe(true);
    for (const p of res.placements) {
      expect(p.mustSeeRating).toBe(p.sightlines["fx3"]);
      expect(p.mustSeeRating).not.toBe("poor");
    }
  });
});
