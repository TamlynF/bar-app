import { describe, expect, it } from "vitest";
import { computeAvailableBandDates, slotsWithinOpeningHours } from "../band-availability";
import type { EventClashCandidate } from "../event-form-validation";
import type { OpeningHours } from "../opening-hours";

const OPEN_LATE: OpeningHours = {
  monday: { open: "17:00", close: "22:30" },
  tuesday: { open: "17:00", close: "23:00" },
  wednesday: { open: "17:00", close: "23:00" },
  thursday: { open: "17:00", close: "23:00" },
  friday: { open: "17:00", close: "01:00" },
  saturday: { open: "12:00", close: "01:00" },
  sunday: { open: "12:00", close: "23:00" },
};

describe("slotsWithinOpeningHours", () => {
  it("keeps both slots when the venue is open past 11pm", () => {
    expect(slotsWithinOpeningHours(OPEN_LATE, 5)).toEqual(["20:00", "21:00"]);
  });

  it("drops the 9pm slot when the venue closes at 10:30pm", () => {
    expect(slotsWithinOpeningHours(OPEN_LATE, 1)).toEqual(["20:00"]);
  });

  it("returns nothing on a closed day", () => {
    expect(slotsWithinOpeningHours({ sunday: {} }, 0)).toEqual([]);
  });

  it("returns nothing without opening hours", () => {
    expect(slotsWithinOpeningHours(null, 5)).toEqual([]);
  });
});

describe("computeAvailableBandDates", () => {
  const base = { from: "2026-08-01", to: "2026-08-31", openingHours: OPEN_LATE };

  it("only offers Fridays and Saturdays in an ordinary month", () => {
    const dates = computeAvailableBandDates({ ...base, events: [] });
    expect(dates).toEqual([
      "2026-08-01",
      "2026-08-07",
      "2026-08-08",
      "2026-08-14",
      "2026-08-15",
      "2026-08-21",
      "2026-08-22",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
    ]);
  });

  it("adds the August bank holiday Monday and the Sunday before it", () => {
    const dates = computeAvailableBandDates({ ...base, events: [] });
    expect(dates).toContain("2026-08-31");
    expect(dates).toContain("2026-08-30");
  });

  it("drops a date when active events block both slots", () => {
    const events: EventClashCandidate[] = [
      {
        id: 1,
        title: "Quiz Night",
        date: "2026-08-07",
        start_time: "19:00:00",
        end_time: "23:30:00",
        is_active: true,
      },
    ];
    expect(computeAvailableBandDates({ ...base, events })).not.toContain("2026-08-07");
  });

  it("keeps a date when one slot is still free", () => {
    const events: EventClashCandidate[] = [
      {
        id: 1,
        title: "Early Set",
        date: "2026-08-07",
        start_time: "18:00:00",
        end_time: "21:00:00",
        is_active: true,
      },
    ];
    expect(computeAvailableBandDates({ ...base, events })).toContain("2026-08-07");
  });

  it("ignores inactive events and events on other days", () => {
    const events: EventClashCandidate[] = [
      {
        id: 1,
        title: "Cancelled",
        date: "2026-08-07",
        start_time: "19:00:00",
        end_time: "23:30:00",
        is_active: false,
      },
      {
        id: 2,
        title: "Other Day",
        date: "2026-08-06",
        start_time: "19:00:00",
        end_time: "23:30:00",
        is_active: true,
      },
    ];
    expect(computeAvailableBandDates({ ...base, events })).toContain("2026-08-07");
  });

  it("returns nothing without opening hours", () => {
    expect(
      computeAvailableBandDates({ ...base, openingHours: null, events: [] })
    ).toEqual([]);
  });
});
