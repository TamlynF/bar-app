import { describe, it, expect } from "vitest";
import { toCamelCase } from "@/lib/utils";

describe("toCamelCase", () => {
  it("lowercases a single word", () => {
    expect(toCamelCase("Band")).toBe("band");
  });

  it("uppercases interior words, joins them", () => {
    expect(toCamelCase("Live Band")).toBe("liveBand");
  });

  it("splits on non-alphanumeric runs (slashes, extra spaces)", () => {
    expect(toCamelCase("Singer / Solo Artist")).toBe("singerSoloArtist");
  });

  it("normalizes fully-uppercase words", () => {
    expect(toCamelCase("DJ")).toBe("dj");
  });

  it("keeps digits and folds them into the preceding word", () => {
    expect(toCamelCase("Tribute Act 2")).toBe("tributeAct2");
  });

  it("trims and collapses leading/trailing separators", () => {
    expect(toCamelCase("  Acoustic-Duo  ")).toBe("acousticDuo");
  });

  it("returns empty string for a separator-only input", () => {
    expect(toCamelCase(" / - ")).toBe("");
  });
});
