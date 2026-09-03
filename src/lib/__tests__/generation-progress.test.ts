import { describe, it, expect } from "vitest";
import {
  expectedGenerationMs,
  progressAt,
  generationStageLabel,
  describeExpectedWait,
} from "@/lib/quiz/generation-progress";

describe("expectedGenerationMs", () => {
  it("grows with the batch size", () => {
    expect(expectedGenerationMs("question", 12)).toBeGreaterThan(expectedGenerationMs("question", 5));
  });

  it("ranks pictures as the slowest kind and songs above plain questions", () => {
    expect(expectedGenerationMs("picture", 9)).toBeGreaterThan(expectedGenerationMs("song", 9));
    expect(expectedGenerationMs("song", 9)).toBeGreaterThan(expectedGenerationMs("question", 9));
  });

  it("charges pictures per batch of three, not per picture", () => {
    expect(expectedGenerationMs("picture", 3) - expectedGenerationMs("picture", 1)).toBeLessThan(2_000);
    expect(expectedGenerationMs("picture", 4)).toBeGreaterThan(expectedGenerationMs("picture", 3) + 10_000);
  });

  it("treats a zero count as one item", () => {
    expect(expectedGenerationMs("question", 0)).toBe(expectedGenerationMs("question", 1));
  });
});

describe("progressAt", () => {
  it("starts at zero", () => {
    expect(progressAt(0, 20_000)).toBe(0);
    expect(progressAt(-5, 20_000)).toBe(0);
  });

  it("sits at 80% when the estimate runs out", () => {
    expect(progressAt(20_000, 20_000)).toBeCloseTo(0.8, 3);
  });

  it("keeps climbing after the estimate but never reaches the top", () => {
    const atEstimate = progressAt(20_000, 20_000);
    const later = progressAt(60_000, 20_000);
    const muchLater = progressAt(600_000, 20_000);
    expect(later).toBeGreaterThan(atEstimate);
    expect(muchLater).toBeGreaterThan(later);
    expect(muchLater).toBeLessThan(0.97);
  });

  it("is monotonic", () => {
    let previous = 0;
    for (let t = 0; t <= 120_000; t += 1_000) {
      const now = progressAt(t, 30_000);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it("front-loads the movement", () => {
    expect(progressAt(10_000, 20_000)).toBeGreaterThan(0.4);
  });
});

describe("generationStageLabel", () => {
  it("moves a picture round from choosing to drawing once the text call is due", () => {
    expect(generationStageLabel("picture", 0, 9)).toBe("Choosing what to draw…");
    expect(generationStageLabel("picture", 60_000, 9)).toBe("Drawing the pictures…");
  });

  it("keeps one label for the other kinds", () => {
    expect(generationStageLabel("question", 0, 10)).toBe(generationStageLabel("question", 90_000, 10));
    expect(generationStageLabel("song", 0, 5)).toBe(generationStageLabel("song", 90_000, 5));
  });
});

describe("describeExpectedWait", () => {
  it("rounds short waits to the nearest five seconds", () => {
    expect(describeExpectedWait(11_000)).toBe("Usually takes about 10 seconds");
    expect(describeExpectedWait(2_000)).toBe("Usually takes about 5 seconds");
  });

  it("switches to minutes at sixty seconds", () => {
    expect(describeExpectedWait(60_000)).toBe("Usually takes about a minute");
    expect(describeExpectedWait(95_000)).toBe("Usually takes about 1.5 minutes");
  });
});
