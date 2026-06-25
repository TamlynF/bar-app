// Shared geometry model for the floor-plan venue editor and layout calculator.
// All coordinates are in METRES, origin top-left, +x right / +y down.
// `facing` is degrees 0-359 measured clockwise from "up" (north / -y).

export type Point = { x: number; y: number };

/** The irregular room shape: an ordered polygon plus its bounding dimensions. */
export type RoomOutline = {
  points: Point[]; // ordered polygon vertices (>= 3)
  width: number; // bounding-box width (m) — used for the SVG viewport
  length: number; // bounding-box length (m)
};

/**
 * A no-go zone (pillar, store cupboard, ...).
 * - "rect"    → x/y/width/length define an axis-aligned rectangle.
 * - "circle"  → x/y/width/length define the bounding box; width === length === diameter.
 * - "polygon" → `points` are absolute metres; x/y/width/length mirror the bounding box.
 */
export type Obstacle = {
  id: string;
  label: string;
  shape: "rect" | "circle" | "polygon";
  x: number; // top-left of bounding box (m)
  y: number;
  width: number; // (m)
  length: number; // (m)
  points?: Point[]; // present only when shape === "polygon"
  rotation?: number; // degrees 0-359, spins rect/circle footprint (polygon ignores it)
};

export type FixtureType = "stage" | "bar" | "dj_booth" | "projector" | "tv";

/** A named, positioned venue item the user places on the plan. */
export type Fixture = {
  id: string;
  type: FixtureType;
  label: string;
  shape?: "rect" | "circle" | "polygon"; // defaults to "rect" when absent (legacy data)
  x: number; // top-left of bounding box (m)
  y: number;
  width: number; // (m)
  length: number; // (m)
  points?: Point[]; // present only when shape === "polygon"
  facing: number | null; // degrees 0-359; the direction it points (sightline source). null = none
  rotation?: number; // degrees 0-359, spins rect/circle footprint (polygon ignores it)
};

export type FeatureKind = "door" | "window" | "bench";

/**
 * An architectural / permanent-seating element placed on the plan.
 * - "door"   → facing = the inward direction it opens toward; gets a keep-clear zone.
 * - "window" → wall marker; facing optional, purely visual.
 * - "bench"  → permanent seating; `seats` counts toward the event total, facing = which
 *              way seated guests look; blocks table packing.
 */
export type Feature = {
  id: string;
  kind: FeatureKind;
  label: string;
  x: number; // top-left bounding box (m)
  y: number;
  width: number; // (m)
  length: number; // (m)
  facing: number | null; // degrees 0-359
  rotation?: number; // degrees 0-359, spins the footprint
  seats?: number; // bench only
};

/** The full venue geometry stored on `company_information`. */
export type VenueGeometry = {
  room_outline: RoomOutline | null;
  obstacles: Obstacle[];
  fixtures: Fixture[];
  features: Feature[];
};

/** Fixture types that can be a sightline focal point. */
export const FOCAL_FIXTURE_TYPES: FixtureType[] = ["stage", "projector", "tv", "dj_booth"];

/** Fixture types that physically block table packing (service points / structures). */
export const BLOCKING_FIXTURE_TYPES: FixtureType[] = ["stage", "bar", "dj_booth"];

export function isFocalFixture(f: Fixture): boolean {
  return FOCAL_FIXTURE_TYPES.includes(f.type);
}

export function isBlockingFixture(f: Fixture): boolean {
  return BLOCKING_FIXTURE_TYPES.includes(f.type);
}
