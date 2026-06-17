import { describe, it, expect } from "vitest";
import { buildRescheduleEmail } from "@/lib/band-emails";

describe("buildRescheduleEmail", () => {
  it("greets the booker and includes the group name in the body", () => {
    const e = buildRescheduleEmail({
      name: "Jane",
      groupName: "The Test Band",
      date: "2026-07-01",
      startTime: "22:00",
      endTime: "00:00",
    });
    expect(e.greeting).toContain("Jane");
    expect(e.body.join(" ")).toContain("The Test Band");
    expect(e.subject.toLowerCase()).toContain("confirm");
  });

  it("formats the new date and 12h time window", () => {
    const e = buildRescheduleEmail({
      name: "Jane",
      groupName: null,
      date: "2026-07-01",
      startTime: "22:00:00",
      endTime: "00:00:00",
    });
    expect(e.dateLabel).toMatch(/2026/);
    expect(e.dateLabel).toContain("July");
    expect(e.timeLabel).toBe("10:00 PM – 12:00 AM");
  });

  it("leaves date/time labels empty when not set", () => {
    const e = buildRescheduleEmail({ name: "Jane", groupName: null, date: null, startTime: null, endTime: null });
    expect(e.dateLabel).toBe("");
    expect(e.timeLabel).toBe("");
  });
});
