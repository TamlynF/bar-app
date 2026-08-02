import { describe, it, expect } from "vitest";
import { computeTableChairs, chairLayoutSeatCount } from "@/lib/floor-plan/chairs";
import type { ChairLayout } from "@/lib/floor-plan/types";

const baseInput = {
  cx: 5,
  cy: 5,
  width: 0.7,
  length: 1.4,
  diameter: 1.1,
  chairGap: 0.3,
  extraChairs: 0,
};

describe("chairLayoutSeatCount", () => {
  it("falls back to capacity for auto/null", () => {
    expect(chairLayoutSeatCount(null, 6)).toBe(6);
    expect(chairLayoutSeatCount({ mode: "auto" }, 6)).toBe(6);
  });
  it("sums sides + ends", () => {
    expect(chairLayoutSeatCount({ mode: "sides", perSide: 3, ends: 1 }, 0)).toBe(8);
  });
  it("counts both benches", () => {
    expect(chairLayoutSeatCount({ mode: "bench", perSide: 3 }, 0)).toBe(6);
  });
});

describe("computeTableChairs - round", () => {
  it("rings all seats around the table", () => {
    const { chairs, benches } = computeTableChairs({ ...baseInput, shape: "round", baseSeats: 6, layout: null });
    expect(chairs).toHaveLength(6);
    expect(benches).toHaveLength(0);
    const r = 1.1 / 2 + 0.3;
    chairs.forEach((c) => {
      expect(Math.hypot(c.x - 5, c.y - 5)).toBeCloseTo(r, 2);
    });
  });
  it("marks the trailing chairs as extra", () => {
    const { chairs } = computeTableChairs({ ...baseInput, shape: "round", baseSeats: 4, extraChairs: 2, layout: null });
    expect(chairs).toHaveLength(6);
    expect(chairs.filter((c) => c.extra)).toHaveLength(2);
  });
});

describe("computeTableChairs - rect", () => {
  it("auto-splits seats across the two long (left/right) sides of a tall table", () => {
    const { chairs } = computeTableChairs({ ...baseInput, shape: "rect", baseSeats: 6, layout: null });
    expect(chairs).toHaveLength(6);
    const left = chairs.filter((c) => c.x < 5);
    const right = chairs.filter((c) => c.x > 5);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    const off = 0.7 / 2 + 0.3;
    expect(left[0].x).toBeCloseTo(5 - off, 5);
    expect(right[0].x).toBeCloseTo(5 + off, 5);
  });

  it("honours an explicit per-side layout with ends", () => {
    const layout: ChairLayout = { mode: "sides", perSide: 3, ends: 1 };
    const { chairs } = computeTableChairs({ ...baseInput, shape: "rect", baseSeats: 8, layout });
    expect(chairs).toHaveLength(8); // 3 + 3 + 1 + 1
    expect(chairs.filter((c) => c.x < 5 - 0.001)).toHaveLength(3);
    expect(chairs.filter((c) => c.x > 5 + 0.001)).toHaveLength(3);
    expect(chairs.filter((c) => Math.abs(c.y - 5) > 1.4 / 2)).toHaveLength(2);
  });

  it("produces two benches and no chairs in bench mode", () => {
    const layout: ChairLayout = { mode: "bench", perSide: 3 };
    const { chairs, benches } = computeTableChairs({ ...baseInput, shape: "rect", baseSeats: 6, layout });
    expect(chairs).toHaveLength(0);
    expect(benches).toHaveLength(2);
    expect(benches.some((b) => b.x + b.width / 2 < 5)).toBe(true);
    expect(benches.some((b) => b.x + b.width / 2 > 5)).toBe(true);
  });

  it("appends extra chairs at the short ends", () => {
    const { chairs } = computeTableChairs({ ...baseInput, shape: "rect", baseSeats: 6, extraChairs: 2, layout: null });
    expect(chairs).toHaveLength(8);
    const extras = chairs.filter((c) => c.extra);
    expect(extras).toHaveLength(2);
    extras.forEach((c) => expect(Math.abs(c.y - 5)).toBeGreaterThan(1.4 / 2));
  });
});
