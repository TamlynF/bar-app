import { round } from "./geometry";
import type { ChairLayout, Point } from "./types";

export type ChairDot = Point & { extra: boolean };
export type BenchBar = { x: number; y: number; width: number; length: number };

export function chairLayoutSeatCount(layout: ChairLayout | null | undefined, capacity: number): number {
  if (!layout || layout.mode === "auto") return capacity;
  const perSide = Math.max(0, layout.perSide ?? 0);
  const ends = Math.max(0, layout.ends ?? 0);
  if (layout.mode === "bench") return perSide * 2;
  return perSide * 2 + ends * 2;
}

function distribute(count: number, from: number, to: number): number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    out.push(from + t * (to - from));
  }
  return out;
}

export type ChairInput = {
  shape: "round" | "rect";
  cx: number;
  cy: number;
  width: number; // x extent (m)
  length: number; // y extent (m)
  diameter: number; // round (m)
  chairGap: number; // distance from table edge to chair centre (m)
  baseSeats: number;
  extraChairs: number;
  layout: ChairLayout | null;
};

export function computeTableChairs(input: ChairInput): { chairs: ChairDot[]; benches: BenchBar[] } {
  const { shape, cx, cy, chairGap, baseSeats, extraChairs, layout } = input;
  const base = Math.max(0, baseSeats);
  const extra = Math.max(0, extraChairs);

  if (shape === "round") {
    const r = (input.diameter > 0 ? input.diameter : Math.max(input.width, input.length)) / 2 + chairGap;
    const total = base + extra;
    const chairs: ChairDot[] = [];
    for (let i = 0; i < total; i++) {
      const a = ((-90 + (360 / Math.max(1, total)) * i) * Math.PI) / 180;
      chairs.push({ x: round(cx + r * Math.cos(a), 3), y: round(cy + r * Math.sin(a), 3), extra: i >= base });
    }
    return { chairs, benches: [] };
  }

  const w = input.width > 0 ? input.width : 1.2;
  const l = input.length > 0 ? input.length : 0.7;
  const halfW = w / 2;
  const halfL = l / 2;
  const longVertical = l >= w; // long sides are left/right when the table is taller than wide
  const mode = layout?.mode ?? "auto";

  let long1: number;
  let long2: number;
  let end1 = 0;
  let end2 = 0;
  if (mode === "sides" || mode === "bench") {
    const perSide = Math.max(0, layout?.perSide ?? Math.ceil(base / 2));
    long1 = perSide;
    long2 = perSide;
    if (mode === "sides") {
      const ends = Math.max(0, layout?.ends ?? 0);
      end1 = ends;
      end2 = ends;
    }
  } else {
    long1 = Math.ceil(base / 2);
    long2 = base - long1;
  }

  const extra1 = Math.ceil(extra / 2);
  const extra2 = extra - extra1;

  const chairs: ChairDot[] = [];
  const benches: BenchBar[] = [];

  const longOffset = (longVertical ? halfW : halfL) + chairGap;
  const endOffset = (longVertical ? halfL : halfW) + chairGap;

  if (mode === "bench") {
    const depth = chairGap * 1.3;
    if (longVertical) {
      const len = l * 0.92;
      benches.push({ x: cx - halfW - chairGap - depth, y: cy - len / 2, width: depth, length: len });
      benches.push({ x: cx + halfW + chairGap, y: cy - len / 2, width: depth, length: len });
    } else {
      const len = w * 0.92;
      benches.push({ x: cx - len / 2, y: cy - halfL - chairGap - depth, width: len, length: depth });
      benches.push({ x: cx - len / 2, y: cy + halfL + chairGap, width: len, length: depth });
    }
  } else {
    if (longVertical) {
      distribute(long1, cy - halfL, cy + halfL).forEach((y) => chairs.push({ x: round(cx - longOffset, 3), y: round(y, 3), extra: false }));
      distribute(long2, cy - halfL, cy + halfL).forEach((y) => chairs.push({ x: round(cx + longOffset, 3), y: round(y, 3), extra: false }));
    } else {
      distribute(long1, cx - halfW, cx + halfW).forEach((x) => chairs.push({ x: round(x, 3), y: round(cy - longOffset, 3), extra: false }));
      distribute(long2, cx - halfW, cx + halfW).forEach((x) => chairs.push({ x: round(x, 3), y: round(cy + longOffset, 3), extra: false }));
    }
  }

  const endTotal1 = end1 + extra1;
  const endTotal2 = end2 + extra2;
  const placeEnd = (count: number, baseCount: number, sign: 1 | -1) => {
    if (count <= 0) return;
    const coords = longVertical
      ? distribute(count, cx - halfW, cx + halfW)
      : distribute(count, cy - halfL, cy + halfL);
    coords.forEach((c, i) => {
      const isExtra = i >= baseCount;
      if (longVertical) chairs.push({ x: round(c, 3), y: round(cy + sign * endOffset, 3), extra: isExtra });
      else chairs.push({ x: round(cx + sign * endOffset, 3), y: round(c, 3), extra: isExtra });
    });
  };
  placeEnd(endTotal1, end1, -1);
  placeEnd(endTotal2, end2, 1);

  return { chairs, benches };
}
