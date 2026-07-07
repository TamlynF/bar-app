import { describe, it, expect } from "vitest";
import { parseGbp, formatGbp } from "@/lib/price";

describe("parseGbp", () => {
  it("parses a plain pound value", () => {
    expect(parseGbp("£4.50")).toBe(4.5);
  });

  it("parses a bare number", () => {
    expect(parseGbp("4.5")).toBe(4.5);
  });

  it("takes the base price and ignores a parenthesised surcharge", () => {
    expect(parseGbp("£5 (+£1.45 mixer)")).toBe(5);
  });

  it("tolerates thousands separators", () => {
    expect(parseGbp("£1,200")).toBe(1200);
  });

  it("parses an integer pound value", () => {
    expect(parseGbp("£6")).toBe(6);
  });

  it("returns null for junk with no digits", () => {
    expect(parseGbp("Market Price")).toBeNull();
  });

  it("returns null for null/empty input", () => {
    expect(parseGbp(null)).toBeNull();
    expect(parseGbp("")).toBeNull();
    expect(parseGbp(undefined)).toBeNull();
  });
});

describe("formatGbp", () => {
  it("formats to two decimals with a pound sign", () => {
    expect(formatGbp(4.5)).toBe("£4.50");
    expect(formatGbp(6)).toBe("£6.00");
  });

  it("renders an em dash for null/invalid", () => {
    expect(formatGbp(null)).toBe("—");
    expect(formatGbp(undefined)).toBe("—");
  });
});
