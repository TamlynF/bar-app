import { describe, expect, it } from "vitest";
import { eventSlotIsComplete, resolveEventIsActive } from "../event-active";

describe("eventSlotIsComplete", () => {
  it("is true only when the date and both times are set", () => {
    expect(eventSlotIsComplete({ date: "2026-07-28", startTime: "19:00", endTime: "21:00" })).toBe(true);
  });

  it("is false when any part of the slot is missing", () => {
    expect(eventSlotIsComplete({ date: null, startTime: "19:00", endTime: "21:00" })).toBe(false);
    expect(eventSlotIsComplete({ date: "2026-07-28", startTime: null, endTime: "21:00" })).toBe(false);
    expect(eventSlotIsComplete({ date: "2026-07-28", startTime: "19:00", endTime: null })).toBe(false);
    expect(eventSlotIsComplete({})).toBe(false);
  });

  it("treats blank strings as missing", () => {
    expect(eventSlotIsComplete({ date: "2026-07-28", startTime: "   ", endTime: "21:00" })).toBe(false);
  });
});

describe("resolveEventIsActive", () => {
  it("keeps an event inactive when it was not requested active", () => {
    expect(resolveEventIsActive(false, { date: "2026-07-28", startTime: "19:00", endTime: "21:00" })).toBe(false);
  });

  it("forces an event inactive when the slot is incomplete", () => {
    expect(resolveEventIsActive(true, { date: "2026-07-28", startTime: "19:00", endTime: null })).toBe(false);
  });

  it("stays active when requested and the slot is complete", () => {
    expect(resolveEventIsActive(true, { date: "2026-07-28", startTime: "19:00", endTime: "21:00" })).toBe(true);
  });
});
