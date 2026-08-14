export type Point = { x: number; y: number };

export type RoomOutline = {
  points: Point[]; // ordered polygon vertices (>= 3)
  width: number; // bounding-box width (m) - used for the SVG viewport
  length: number; // bounding-box length (m)
};

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
  height?: number; // top of the solid mass above the floor (m); absent = blocks any sightline
};

export type ChairLayout = {
  mode: "auto" | "sides" | "bench";
  perSide?: number;
  ends?: number;
};

export type FixtureType = "stage" | "bar" | "dj_booth" | "projector" | "tv";

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
  height?: number; // top of the solid mass above the floor (m); what guests must see over
  viewHeight?: number; // height of the thing guests actually look at (m) - screen, performer, DJ
};

export type FeatureKind = "door" | "window" | "bench";

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
  height?: number; // top of the solid mass above the floor (m)
};

export type VenueGeometry = {
  room_outline: RoomOutline | null;
  obstacles: Obstacle[];
  fixtures: Fixture[];
  features: Feature[];
};

export const FOCAL_FIXTURE_TYPES: FixtureType[] = ["stage", "projector", "tv", "dj_booth"];

export const BLOCKING_FIXTURE_TYPES: FixtureType[] = ["stage", "bar", "dj_booth"];

export const EYE_HEIGHT = 1.2; // seated guest's eye level (m)

export const DEFAULT_FIXTURE_HEIGHT: Record<FixtureType, number> = {
  stage: 0.6,
  bar: 1.1,
  dj_booth: 1.5,
  projector: 0,
  tv: 0,
};

export const DEFAULT_VIEW_HEIGHT: Record<FixtureType, number> = {
  stage: 1.9,
  bar: 1.1,
  dj_booth: 1.7,
  projector: 2.2,
  tv: 1.8,
};

// How far off a focal's forward axis a guest can sit before the view degrades.
// A flat screen is only legible from the front; a stage or booth is a solid object
// you can watch from the side, so it earns much wider limits.
export const ANGLE_LIMITS: Record<FixtureType, { good: number; ok: number }> = {
  projector: { good: 50, ok: 95 },
  tv: { good: 50, ok: 95 },
  stage: { good: 85, ok: 130 },
  dj_booth: { good: 85, ok: 130 },
  bar: { good: 85, ok: 130 },
};

export const DEFAULT_FEATURE_HEIGHT: Record<FeatureKind, number> = {
  door: 2,
  window: 1.2,
  bench: 0.45,
};

export function fixtureBlockHeight(f: Fixture): number {
  return f.height ?? DEFAULT_FIXTURE_HEIGHT[f.type];
}

export function fixtureViewHeight(f: Fixture): number {
  return f.viewHeight ?? DEFAULT_VIEW_HEIGHT[f.type];
}

export function featureBlockHeight(f: Feature): number {
  return f.height ?? DEFAULT_FEATURE_HEIGHT[f.kind];
}

export function isFocalFixture(f: Fixture): boolean {
  return FOCAL_FIXTURE_TYPES.includes(f.type);
}

export function isBlockingFixture(f: Fixture): boolean {
  return BLOCKING_FIXTURE_TYPES.includes(f.type);
}
