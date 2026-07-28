import { describe, it, expect } from "vitest";
import { normalizeGroupName } from "../group-name";

describe("normalizeGroupName", () => {
  it("strips every space and lowercases", () => {
    expect(normalizeGroupName("  Happy  Days ")).toBe("happydays");
    expect(normalizeGroupName("happy days")).toBe("happydays");
    expect(normalizeGroupName("HAPPYDAYS")).toBe("happydays");
  });

  it("treats tabs and newlines as spacing", () => {
    expect(normalizeGroupName("Happy\tDays\n")).toBe("happydays");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeGroupName("   ")).toBe("");
    expect(normalizeGroupName(null)).toBe("");
    expect(normalizeGroupName(undefined)).toBe("");
  });

  it("keeps distinct names distinct", () => {
    expect(normalizeGroupName("Happy Days")).not.toBe(normalizeGroupName("Happy Daze"));
  });
});
