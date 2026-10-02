import { describe, expect, it } from "vitest";
import { describeOpenSessionClash, openSessionClash } from "@/lib/opening-hours";

const hours = {
  thursday: { open: "19:00", close: "23:00" },
  friday: { open: "19:00", close: "02:00" },
  saturday: { open: "19:00", close: "02:00" },
};
const at = (h: number, m = 0) => h * 60 + m;

describe("openSessionClash", () => {
  it("flags a slot that overlaps that evening's session", () => {
    expect(openSessionClash(hours, "2026-10-02", at(17), at(21))).toMatchObject({ dayIndex: 5 });
    expect(openSessionClash(hours, "2026-10-01", at(22), at(23, 30))).toMatchObject({ dayIndex: 4 });
  });

  it("allows slots that finish before opening or fall on closed days", () => {
    expect(openSessionClash(hours, "2026-10-02", at(12), at(19))).toBeNull();
    expect(openSessionClash(hours, "2026-10-05", at(19), at(1))).toBeNull();
  });

  it("counts the previous night's session that runs past midnight", () => {
    expect(openSessionClash(hours, "2026-10-03", at(1), at(4))).toMatchObject({ dayIndex: 5 });
    expect(openSessionClash(hours, "2026-10-03", at(2), at(6))).toBeNull();
  });

  it("catches a late slot running into the next day's session", () => {
    expect(openSessionClash(hours, "2026-10-01", at(23, 30), at(1))).toBeNull();
    expect(openSessionClash(hours, "2026-10-02", at(15), at(19, 30))).toMatchObject({ dayIndex: 5 });
  });

  it("explains the clash in plain words", () => {
    const clash = openSessionClash(hours, "2026-10-02", at(20), at(23))!;
    expect(describeOpenSessionClash(clash)).toContain("Fridays from 7pm to 2am");
  });
});
