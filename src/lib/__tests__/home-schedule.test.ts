import { describe, expect, it } from "vitest";
import { countdownLabel, groupSchedule, nightLabel } from "@/lib/home-schedule";
import type { SerializedEvent } from "@/lib/events-display";

function ev(id: number, date: string, title = `Event ${id}`): SerializedEvent {
  return {
    id,
    title,
    date,
    startTimeLabel: "8pm",
    endTimeLabel: null,
    externalLink: null,
    isFullyBooked: false,
    isBookable: false,
    requiresSeating: false,
    bookingPageUrl: null,
    color: "#FDCC4B",
    subType: null,
    tagline: null,
    imageUrl: null,
    price: null,
    isKaraoke: false,
    karaokeRequestUrl: null,
    behavior: "standard",
    band: null,
  } as SerializedEvent;
}

describe("groupSchedule", () => {
  it("groups by month, then shares a day tile for events on the same date", () => {
    const months = groupSchedule([
      ev(1, "2026-09-24"),
      ev(2, "2026-09-26"),
      ev(3, "2026-09-26"),
      ev(4, "2026-10-30"),
    ]);
    expect(months.map((m) => m.label)).toEqual(["September", "October"]);
    expect(months[0].days.map((d) => d.events.length)).toEqual([1, 2]);
    expect(months[0].days[1].dayShort).toBe("Sat");
    expect(months[1].days[0].dayNumber).toBe("30");
  });

  it("stops after the limit without splitting a month header away from its days", () => {
    const months = groupSchedule([ev(1, "2026-09-24"), ev(2, "2026-09-26"), ev(3, "2026-10-01")], 2);
    expect(months).toHaveLength(1);
    expect(months[0].days).toHaveLength(2);
  });

  it("returns nothing for an empty schedule", () => {
    expect(groupSchedule([])).toEqual([]);
  });
});

describe("countdownLabel", () => {
  const today = new Date(2026, 8, 21);
  it("names tonight, tomorrow and a day count", () => {
    expect(countdownLabel("2026-09-21", today)).toBe("Tonight");
    expect(countdownLabel("2026-09-22", today)).toBe("Tomorrow");
    expect(countdownLabel("2026-09-24", today)).toBe("In 3 days");
  });
});

describe("nightLabel", () => {
  const friday = new Date(2026, 9, 2);

  it("names the night within the coming week, and the date beyond it", () => {
    expect(nightLabel("2026-10-02", friday)).toBe("Tonight");
    expect(nightLabel("2026-10-03", friday)).toBe("This Saturday");
    expect(nightLabel("2026-10-10", friday)).toBe("Saturday 10 October");
  });
});
