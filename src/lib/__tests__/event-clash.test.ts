import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  toHHMM,
  addHoursToTime,
  rangesOverlap,
  findEventClashes,
  type ClashEventInput,
} from "@/lib/event-clash";

describe("parseTimeToMinutes", () => {
  it("parses HH:MM, HH:MM:SS and timetz forms", () => {
    expect(parseTimeToMinutes("22:00")).toBe(22 * 60);
    expect(parseTimeToMinutes("22:00:00")).toBe(22 * 60);
    expect(parseTimeToMinutes("09:30:00+00")).toBe(9 * 60 + 30);
  });

  it("returns null for empty/invalid", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("nope")).toBeNull();
    expect(parseTimeToMinutes("99:99")).toBeNull();
  });
});

describe("toHHMM", () => {
  it("normalises to HH:MM and drops seconds/timezone", () => {
    expect(toHHMM("22:00:00+00")).toBe("22:00");
    expect(toHHMM("9:05")).toBe("09:05");
    expect(toHHMM(null)).toBe("");
  });
});

describe("addHoursToTime", () => {
  it("adds hours and wraps past midnight", () => {
    expect(addHoursToTime("22:00", 2)).toBe("00:00"); // the spec default end
    expect(addHoursToTime("20:30", 2)).toBe("22:30");
    expect(addHoursToTime("23:30", 2)).toBe("01:30");
  });

  it("returns '' for invalid input", () => {
    expect(addHoursToTime(null, 2)).toBe("");
  });
});

describe("rangesOverlap", () => {
  it("is half-open (touching edges do not overlap)", () => {
    expect(rangesOverlap({ s: 0, e: 60 }, { s: 60, e: 120 })).toBe(false);
    expect(rangesOverlap({ s: 0, e: 61 }, { s: 60, e: 120 })).toBe(true);
  });
});

describe("findEventClashes", () => {
  const events: ClashEventInput[] = [
    { id: 1, title: "Live Gig", start_time: "19:30:00+00", end_time: "23:00:00+00" },
    { id: 2, title: "Morning Yoga", start_time: "09:00:00+00", end_time: "10:00:00+00" },
    { id: 3, title: "No End", start_time: "22:00:00+00", end_time: null },
  ];

  it("flags an overlapping event (band 22:00–00:00 vs gig 19:30–23:00)", () => {
    const clashes = findEventClashes({ start: "22:00", end: "00:00" }, events);
    expect(clashes.map((c) => c.id)).toContain(1);
    expect(clashes.find((c) => c.id === 1)).toMatchObject({ title: "Live Gig", start: "19:30", end: "23:00" });
  });

  it("does not flag non-overlapping events", () => {
    const clashes = findEventClashes({ start: "22:00", end: "00:00" }, events);
    expect(clashes.map((c) => c.id)).not.toContain(2); // morning
  });

  it("returns nothing when there is no target start", () => {
    expect(findEventClashes({ start: null, end: "00:00" }, events)).toEqual([]);
  });

  it("handles an overnight target window", () => {
    // 23:00–01:00 overlaps the gig ending 23:00? No (half-open), but overlaps "No End" at 22:00? no.
    const clashes = findEventClashes({ start: "23:00", end: "01:00" }, events);
    expect(clashes.map((c) => c.id)).not.toContain(1);
  });
});
