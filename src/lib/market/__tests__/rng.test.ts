import { describe, expect, it } from "vitest";
import { mulberry32, tickRng, tickSeed } from "../rng";

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is roughly uniform", () => {
    const rng = mulberry32(123);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += rng();
    expect(sum / 5000).toBeGreaterThan(0.45);
    expect(sum / 5000).toBeLessThan(0.55);
  });
});

describe("tickSeed", () => {
  it("differs across ticks and sessions", () => {
    expect(tickSeed(1, 1)).not.toBe(tickSeed(1, 2));
    expect(tickSeed(1, 1)).not.toBe(tickSeed(2, 1));
  });

  it("gives a deterministic rng per (session, tick)", () => {
    expect(tickRng(3, 9)()).toBe(tickRng(3, 9)());
  });
});
