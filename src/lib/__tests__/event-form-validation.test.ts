import { describe, it, expect } from "vitest";
import {
  eventRequiredFieldsMissing,
  findActiveEventClashes,
  validateEventForm,
  type EventClashCandidate,
  type EventFormFields,
} from "@/lib/event-form-validation";

const validFields: EventFormFields = {
  eventTypesId: 1,
  eventSubtypesId: 2,
  title: "Quiz Night",
  date: "2026-06-25",
  startTime: "19:00",
  endTime: "22:00",
};

describe("eventRequiredFieldsMissing", () => {
  it("passes when all required fields are set", () => {
    expect(eventRequiredFieldsMissing(validFields)).toBe(false);
  });

  it.each([
    ["eventTypesId", { eventTypesId: null }],
    ["eventSubtypesId", { eventSubtypesId: null }],
    ["title", { title: "   " }],
    ["date", { date: "" }],
    ["startTime", { startTime: "" }],
    ["endTime", { endTime: "" }],
  ])("flags missing %s", (_label, patch) => {
    expect(eventRequiredFieldsMissing({ ...validFields, ...patch })).toBe(true);
  });
});

describe("findActiveEventClashes", () => {
  const candidates: EventClashCandidate[] = [
    { id: 1, title: "Live Gig", date: "2026-06-25", start_time: "19:30:00", end_time: "23:00:00", is_active: true },
    { id: 2, title: "Morning Yoga", date: "2026-06-25", start_time: "09:00:00", end_time: "10:00:00", is_active: true },
    { id: 3, title: "Other Day", date: "2026-06-26", start_time: "19:00:00", end_time: "22:00:00", is_active: true },
    { id: 4, title: "Inactive Clash", date: "2026-06-25", start_time: "19:00:00", end_time: "22:00:00", is_active: false },
  ];

  it("flags an overlapping active event on the same date", () => {
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "19:00", end: "22:00" }, candidates);
    expect(clashes.map((c) => c.id)).toEqual([1]);
    expect(clashes[0]).toMatchObject({ title: "Live Gig", start: "19:30", end: "23:00" });
  });

  it("ignores events on other dates", () => {
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "19:00", end: "22:00" }, candidates);
    expect(clashes.map((c) => c.id)).not.toContain(3);
  });

  it("ignores inactive events", () => {
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "19:00", end: "22:00" }, candidates);
    expect(clashes.map((c) => c.id)).not.toContain(4);
  });

  it("ignores non-overlapping times", () => {
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "11:00", end: "12:00" }, candidates);
    expect(clashes).toEqual([]);
  });

  it("allows back-to-back times (touching edges do not clash)", () => {
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "17:00", end: "19:30" }, candidates);
    expect(clashes).toEqual([]);
  });

  it("excludes the event being edited (self)", () => {
    const clashes = findActiveEventClashes({ id: 1, date: "2026-06-25", start: "19:30", end: "23:00" }, candidates);
    expect(clashes).toEqual([]);
  });

  it("matches self id regardless of string/number type", () => {
    const clashes = findActiveEventClashes({ id: "1", date: "2026-06-25", start: "19:30", end: "23:00" }, candidates);
    expect(clashes).toEqual([]);
  });

  it("treats null is_active as active", () => {
    const withNull: EventClashCandidate[] = [
      { id: 9, title: "Legacy", date: "2026-06-25", start_time: "19:00", end_time: "22:00", is_active: null },
    ];
    const clashes = findActiveEventClashes({ date: "2026-06-25", start: "20:00", end: "21:00" }, withNull);
    expect(clashes.map((c) => c.id)).toEqual([9]);
  });
});

describe("validateEventForm", () => {
  const noClash: EventClashCandidate[] = [];

  it("returns ok for valid, clash-free input", () => {
    expect(validateEventForm(validFields, noClash)).toEqual({ ok: true });
  });

  it("returns missing_fields before checking anything else", () => {
    const result = validateEventForm({ ...validFields, title: "" }, noClash);
    expect(result).toEqual({ ok: false, code: "missing_fields" });
  });

  it("returns end_before_start when end equals start", () => {
    const result = validateEventForm({ ...validFields, startTime: "20:00", endTime: "20:00" }, noClash);
    expect(result).toEqual({ ok: false, code: "end_before_start" });
  });

  it("returns end_before_start when end is before start", () => {
    const result = validateEventForm({ ...validFields, startTime: "22:00", endTime: "19:00" }, noClash);
    expect(result).toEqual({ ok: false, code: "end_before_start" });
  });

  it("allows an overnight end between midnight and 6am", () => {
    const result = validateEventForm({ ...validFields, startTime: "22:00", endTime: "01:00" }, noClash);
    expect(result).toEqual({ ok: true });
  });

  it("allows an end at exactly 6am (overnight boundary)", () => {
    const result = validateEventForm({ ...validFields, startTime: "22:00", endTime: "06:00" }, noClash);
    expect(result).toEqual({ ok: true });
  });

  it("still rejects an end after 6am that is before the start", () => {
    const result = validateEventForm({ ...validFields, startTime: "22:00", endTime: "06:30" }, noClash);
    expect(result).toEqual({ ok: false, code: "end_before_start" });
  });

  it("returns a clash with the offending event", () => {
    const candidates: EventClashCandidate[] = [
      { id: 7, title: "Bingo", date: "2026-06-25", start_time: "20:00", end_time: "21:00", is_active: true },
    ];
    const result = validateEventForm(validFields, candidates);
    expect(result).toMatchObject({ ok: false, code: "clash", clash: { id: 7, title: "Bingo" } });
  });

  it("does not clash with itself when editing", () => {
    const candidates: EventClashCandidate[] = [
      { id: 7, title: "Quiz Night", date: "2026-06-25", start_time: "19:00", end_time: "22:00", is_active: true },
    ];
    expect(validateEventForm(validFields, candidates, 7)).toEqual({ ok: true });
  });
});
