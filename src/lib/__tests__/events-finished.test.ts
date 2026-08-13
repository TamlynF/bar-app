import { describe, it, expect } from "vitest";
import { finishedEventOrFilter } from "@/lib/events-finished";

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
