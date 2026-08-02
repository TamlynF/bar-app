import { describe, it, expect } from "vitest";
import { badgeClassFromColor, swatchHexFromColor, swatchClassFromColor, FALLBACK_BADGE } from "@/lib/event-type-colors";

describe("event-type-colors", () => {
  it("maps a known colour key to its badge classes", () => {
    expect(badgeClassFromColor("red")).toContain("bg-red-100");
    expect(badgeClassFromColor("fuchsia")).toContain("text-fuchsia-700");
  });

  it("falls back for unknown / null colours", () => {
    expect(badgeClassFromColor("not-a-colour")).toBe(FALLBACK_BADGE);
    expect(badgeClassFromColor(null)).toBe(FALLBACK_BADGE);
    expect(badgeClassFromColor(undefined)).toBe(FALLBACK_BADGE);
  });

  it("resolves hex + swatch class for known colours", () => {
    expect(swatchHexFromColor("red")).toBe("#F87171");
    expect(swatchHexFromColor(null)).toBeUndefined();
    expect(swatchClassFromColor("teal")).toBe("swatch-teal");
    expect(swatchClassFromColor("nope")).toBe("bg-[#F4F1E8]");
  });
});
