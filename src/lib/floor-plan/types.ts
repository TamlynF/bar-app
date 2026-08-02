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
};

export type VenueGeometry = {
  room_outline: RoomOutline | null;
  obstacles: Obstacle[];
  fixtures: Fixture[];
  features: Feature[];
};

export const FOCAL_FIXTURE_TYPES: FixtureType[] = ["stage", "projector", "tv", "dj_booth"];

export const BLOCKING_FIXTURE_TYPES: FixtureType[] = ["stage", "bar", "dj_booth"];

export function isFocalFixture(f: Fixture): boolean {
  return FOCAL_FIXTURE_TYPES.includes(f.type);
}

export function isBlockingFixture(f: Fixture): boolean {
  return BLOCKING_FIXTURE_TYPES.includes(f.type);
}
