import { describe, expect, it } from "vitest";
import { exclusionKey, neverShowByDefault, withoutExcluded } from "@/lib/quiz/exclusion-key";

describe("exclusionKey", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(exclusionKey("What is the chemical symbol for Gold?")).toBe(
      exclusionKey("  what is the chemical   symbol for gold ")
    );
  });

  it("strips accents", () => {
    expect(exclusionKey("Beyoncé - Halo")).toBe("beyonce halo");
  });

  it("reads & as and", () => {
    expect(exclusionKey("Simon & Garfunkel")).toBe(exclusionKey("Simon and Garfunkel"));
  });

  it("keeps different questions apart", () => {
    expect(exclusionKey("Capital of France?")).not.toBe(exclusionKey("Capital of Spain?"));
  });
});

describe("withoutExcluded", () => {
  const items = [{ q: "Capital of France?" }, { q: "Capital of Spain?" }];

  it("drops items whose key is excluded", () => {
    const keys = new Set([exclusionKey("capital of france")]);
    expect(withoutExcluded(items, (i) => i.q, keys)).toEqual([{ q: "Capital of Spain?" }]);
  });

  it("returns everything when nothing is excluded", () => {
    expect(withoutExcluded(items, (i) => i.q, new Set())).toBe(items);
  });
});

describe("neverShowByDefault", () => {
  it("hides unpicked cards except in Higher-or-Lower rounds", () => {
    expect(neverShowByDefault(false)).toBe(true);
    expect(neverShowByDefault(true)).toBe(false);
  });
});
