import { describe, it, expect } from "vitest";
import { labelFitsInside, labelTextWidth, layoutLabels, type LabelInput } from "@/lib/floor-plan/labels";

const FONT = 0.33;
const OPTS = { fontSize: FONT, viewWidth: 12.6 };

const shape = (
  key: string,
  text: string,
  x: number,
  y: number,
  width: number,
  length: number,
  rotation = 0
): LabelInput => ({
  key,
  text,
  bounds: { minX: x, minY: y, maxX: x + width, maxY: y + length },
  width,
  length,
  rotation,
  outsideOnly: false,
  ink: "#000000",
});

describe("labelFitsInside", () => {
  const th = FONT * 1.2;

  it("accepts a label that clears a roomy shape", () => {
    expect(labelFitsInside(4.3, 1.3, 2, labelTextWidth("DJ Booth", FONT), th)).toBe(true);
  });

  it("rejects a label wider than a thin bar", () => {
    expect(labelFitsInside(1, 0.2, 305, labelTextWidth("Projector", FONT), th)).toBe(false);
    expect(labelFitsInside(1.2, 0.15, 0, labelTextWidth("TV1", FONT), th)).toBe(false);
    expect(labelFitsInside(5, 0.2, 0, labelTextWidth("Window1", FONT), th)).toBe(false);
  });

  it("rejects a label that overflows a small pillar", () => {
    expect(labelFitsInside(0.6, 0.6, 0, labelTextWidth("Pillar 1", FONT), th)).toBe(false);
  });

  it("accounts for rotation, not just the raw dimensions", () => {
    const tw = labelTextWidth("Stage", FONT);
    expect(labelFitsInside(2, 1, 0, tw, th)).toBe(true);
    expect(labelFitsInside(2, 1, 90, tw, th)).toBe(false); // same box, turned on its side
  });
});

describe("layoutLabels", () => {
  it("puts a roomy shape's label at its centre and a thin one's outside", () => {
    const [bar, tv] = layoutLabels([shape("bar", "Bar", 2, 2, 2.4, 3.2, 35), shape("tv", "TV1", 7.5, 1.2, 1.2, 0.15)], OPTS);
    expect(bar.inside).toBe(true);
    expect(bar.y).toBeCloseTo(bar.cy);
    expect(tv.inside).toBe(false);
    expect(tv.y).toBeLessThan(1.2);
  });

  it("separates labels that would land on top of each other", () => {
    const placed = layoutLabels(
      [
        shape("bench", "Bench1 (7)", 6.15, 7.3, 5, 0.4),
        shape("window", "Window1", 6.15, 7.68, 5, 0.2),
      ],
      OPTS
    );
    const [a, b] = placed;
    expect(a.inside).toBe(false);
    expect(b.inside).toBe(false);
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(a.h);
  });

  it("drops a label below its shape when there is no room above", () => {
    const placed = layoutLabels(
      [shape("a", "Stairs", 6.35, 0.12, 1, 1), shape("b", "DJ Booth", 6.4, 0.15, 1, 0.2)],
      OPTS
    );
    expect(placed.every((l) => l.y - l.h / 2 >= 0 || l.y > 0.3)).toBe(true);
  });

  it("keeps a label from running off the left edge", () => {
    const [only] = layoutLabels([shape("edge", "Pillar 1", 0, 3, 0.6, 0.6)], OPTS);
    expect(only.x - only.w / 2).toBeGreaterThanOrEqual(-1e-9);
  });

  it("sends an outside-only label out even when it would comfortably fit", () => {
    const [poly] = layoutLabels([{ ...shape("p", "Alcove", 1, 1, 6, 6), outsideOnly: true }], OPTS);
    expect(poly.inside).toBe(false);
    expect(poly.y).toBeLessThan(poly.cy);
  });

  it("keeps the leader anchored to the shape centre", () => {
    const [tv] = layoutLabels([shape("tv", "TV2", 3.05, 6.55, 1.2, 0.15)], OPTS);
    expect(tv.cx).toBeCloseTo(3.65);
    expect(tv.cy).toBeCloseTo(6.625);
  });

  it("never leaves two labels overlapping", () => {
    const crowd = [
      shape("a", "Door", 2, 6.75, 0.9, 0.15),
      shape("b", "Window2", 2.1, 6.8, 1.8, 0.1),
      shape("c", "Pillar 1", 2.2, 6.9, 0.6, 0.6),
      shape("d", "Bench1 (7)", 2.15, 7, 5, 0.4),
    ];
    const placed = layoutLabels(crowd, OPTS);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const apart =
          Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1e-9 || Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 1e-9;
        expect(apart).toBe(true);
      }
    }
  });
});
