import { describe, expect, it } from "vitest";
import {
  bandDateRules,
  computeAvailableBandDates,
  describeBandNights,
  slotsWithinOpeningHours,
} from "../band-availability";
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
    ]);
  });

  it("adds the Sunday before the August bank holiday, but not the Monday itself", () => {
    const dates = computeAvailableBandDates({ ...base, events: [] });
    expect(dates).toContain("2026-08-30");
    expect(dates).not.toContain("2026-08-31");
  });

  it("opens a bank holiday when the next day is another bank holiday or a Saturday", () => {
    const christmas = computeAvailableBandDates({
      ...base,
      from: "2026-12-21",
      to: "2026-12-31",
      events: [],
      rules: { weekdays: [], bankHolidays: true },
    });
    expect(christmas).toEqual(["2026-12-24", "2026-12-25", "2026-12-27", "2026-12-31"]);

    const easter = computeAvailableBandDates({
      ...base,
      from: "2027-03-22",
      to: "2027-03-31",
      events: [],
      rules: { weekdays: [], bankHolidays: true },
    });
    expect(easter).toEqual(["2027-03-25", "2027-03-26", "2027-03-28"]);
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

describe("band date rules", () => {
  const base = { from: "2026-08-01", to: "2026-08-31", openingHours: OPEN_LATE, events: [] };

  it("offers only the chosen weekdays when bank holidays are off", () => {
    const dates = computeAvailableBandDates({ ...base, rules: { weekdays: [6], bankHolidays: false } });
    expect(dates).toEqual(["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29"]);
  });

  it("adds the night before a bank holiday to the chosen weekdays", () => {
    const dates = computeAvailableBandDates({ ...base, rules: { weekdays: [6], bankHolidays: true } });
    expect(dates).toContain("2026-08-30");
    expect(dates).not.toContain("2026-08-31");
    expect(dates).not.toContain("2026-08-07");
  });

  it("drops a night that already has a live music event, even with a slot free", () => {
    const events = [
      {
        id: 1,
        title: "Covers Band",
        date: "2026-08-07",
        start_time: "18:00:00",
        end_time: "19:00:00",
        is_active: true,
        is_music: true,
      },
    ];
    expect(computeAvailableBandDates({ ...base, events })).not.toContain("2026-08-07");
  });

  it("keeps a night whose live music event was cancelled", () => {
    const events = [
      {
        id: 1,
        title: "Covers Band",
        date: "2026-08-07",
        start_time: "20:00:00",
        end_time: "22:00:00",
        is_active: false,
        is_music: true,
      },
    ];
    expect(computeAvailableBandDates({ ...base, events })).toContain("2026-08-07");
  });

  it("reads the settings row and falls back to Fridays, Saturdays and bank holidays", () => {
    expect(bandDateRules(null)).toEqual({ weekdays: [5, 6], bankHolidays: true });
    expect(bandDateRules({ band_request_weekdays: [6, 9, 6, 0], band_request_bank_holidays: false })).toEqual({
      weekdays: [0, 6],
      bankHolidays: false,
    });
  });

  it("describes the nights in week order", () => {
    expect(describeBandNights({ weekdays: [5, 6], bankHolidays: true })).toBe(
      "Fridays, Saturdays and the night before a bank holiday"
    );
    expect(describeBandNights({ weekdays: [0, 6], bankHolidays: false })).toBe("Saturdays and Sundays");
    expect(describeBandNights({ weekdays: [6], bankHolidays: false })).toBe("Saturdays");
    expect(describeBandNights({ weekdays: [], bankHolidays: true })).toBe("the night before a bank holiday");
  });
});
