import { describe, it, expect } from "vitest";
import { finishedEventOrFilter, eventHasFinished } from "@/lib/events-finished";

describe("finishedEventOrFilter", () => {
  it("matches any earlier day, or today up to the current time", () => {
    expect(finishedEventOrFilter(new Date(2026, 7, 14, 18, 29, 5))).toBe(
      "date.lt.2026-08-14,and(date.eq.2026-08-14,end_time.lt.18:29:05)"
    );
  });

  it("zero-pads the month, day and time", () => {
    expect(finishedEventOrFilter(new Date(2026, 0, 2, 9, 5, 0))).toBe(
      "date.lt.2026-01-02,and(date.eq.2026-01-02,end_time.lt.09:05:00)"
    );
  });

  it("reads the date and the time off the same clock", () => {
    const justBeforeMidnight = new Date(2026, 7, 14, 23, 59, 59);
    expect(finishedEventOrFilter(justBeforeMidnight)).toContain("date.lt.2026-08-14");
    expect(finishedEventOrFilter(justBeforeMidnight)).toContain("end_time.lt.23:59:59");
  });
});

describe("eventHasFinished", () => {
  const now = new Date(2026, 7, 14, 21, 30, 0);

  it("counts an earlier day as finished", () => {
    expect(eventHasFinished({ date: "2026-08-13", end_time: "23:00:00" }, now)).toBe(true);
  });

  it("counts a later day as still to come", () => {
    expect(eventHasFinished({ date: "2026-08-15", end_time: "09:00:00" }, now)).toBe(false);
  });

  it("uses the end time on the day itself", () => {
    expect(eventHasFinished({ date: "2026-08-14", end_time: "21:00:00" }, now)).toBe(true);
    expect(eventHasFinished({ date: "2026-08-14", end_time: "23:00:00" }, now)).toBe(false);
  });

  it("gives an event with no end time the rest of its day", () => {
    expect(eventHasFinished({ date: "2026-08-14", end_time: null }, now)).toBe(false);
  });

  it("treats an unscheduled event as unfinished", () => {
    expect(eventHasFinished({ date: null, end_time: "21:00:00" }, now)).toBe(false);
  });
});
