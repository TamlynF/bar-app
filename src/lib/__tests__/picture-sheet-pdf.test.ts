import { describe, expect, it } from "vitest";
import { fitContain } from "../quiz/picture-sheet-pdf";

const box = { x: 10, y: 20, width: 56, height: 46 };

describe("fitContain", () => {
  it("scales a wide image to the box width and centres it vertically", () => {
    const placed = fitContain(2000, 1000, box);
    expect(placed.width).toBeCloseTo(56);
    expect(placed.height).toBeCloseTo(28);
    expect(placed.x).toBeCloseTo(10);
    expect(placed.y).toBeCloseTo(20 + (46 - 28) / 2);
  });

  it("scales a tall image to the box height and centres it horizontally", () => {
    const placed = fitContain(500, 1000, box);
    expect(placed.height).toBeCloseTo(46);
    expect(placed.width).toBeCloseTo(23);
    expect(placed.y).toBeCloseTo(20);
    expect(placed.x).toBeCloseTo(10 + (56 - 23) / 2);
  });

  it("never enlarges past the box", () => {
    const placed = fitContain(5600, 4600, box);
    expect(placed.width).toBeCloseTo(56);
    expect(placed.height).toBeCloseTo(46);
  });

  it("collapses an image with no dimensions", () => {
    const placed = fitContain(0, 0, box);
    expect(placed.width).toBe(0);
    expect(placed.height).toBe(0);
  });
});
