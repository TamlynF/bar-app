import { describe, it, expect } from "vitest";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";

describe("privateHireSubtypeLabel", () => {
  it("prefers default_event_title when set", () => {
    expect(privateHireSubtypeLabel({ name: "birthday", default_event_title: "Birthday Bash" }))
      .toBe("Birthday Bash");
  });

  it("falls back to the title-cased name when default_event_title is blank/null", () => {
    expect(privateHireSubtypeLabel({ name: "birthday", default_event_title: null })).toBe("Birthday");
    expect(privateHireSubtypeLabel({ name: "wedding reception", default_event_title: "   " })).toBe("Wedding Reception");
  });

  it("uses the fallback when there is no subtype", () => {
    expect(privateHireSubtypeLabel(null, "Christmas Party")).toBe("Christmas Party");
    expect(privateHireSubtypeLabel(undefined)).toBe("");
  });

  it("uses the fallback when both title and name are empty", () => {
    expect(privateHireSubtypeLabel({ name: "", default_event_title: "" }, "Legacy")).toBe("Legacy");
  });
});

describe("unwrapSubtype", () => {
  it("returns the object as-is", () => {
    const o = { id: 1, name: "x", default_event_title: null };
    expect(unwrapSubtype(o)).toBe(o);
  });

  it("unwraps a single-element array", () => {
    const o = { id: 1, name: "x", default_event_title: null };
    expect(unwrapSubtype([o])).toBe(o);
  });

  it("returns null for null/undefined/empty array", () => {
    expect(unwrapSubtype(null)).toBeNull();
    expect(unwrapSubtype(undefined)).toBeNull();
    expect(unwrapSubtype([])).toBeNull();
  });
});
