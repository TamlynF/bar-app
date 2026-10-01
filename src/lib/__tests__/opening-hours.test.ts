import { describe, it, expect } from "vitest";
import {
  formatClock,
  describeBarStatus,
  describeOpenState,
  shortLocation,
  type OpeningHours,
} from "@/lib/opening-hours";

const HOURS: OpeningHours = {
  thursday: { open: "19:00", close: "22:00" },
  friday: { open: "15:00", close: "01:00" },
  saturday: { open: "15:00", close: "01:00" },
};

const at = (iso: string) => new Date(iso);

describe("formatClock", () => {
  it("drops :00 and uses lowercase meridiem", () => {
    expect(formatClock(15 * 60)).toBe("3pm");
    expect(formatClock(19 * 60)).toBe("7pm");
    expect(formatClock(60)).toBe("1am");
    expect(formatClock(22 * 60 + 30)).toBe("10:30pm");
    expect(formatClock(0)).toBe("12am");
    expect(formatClock(12 * 60)).toBe("12pm");
  });
});

describe("describeOpenState", () => {
  it("reports open during a same-day session", () => {
    expect(describeOpenState(HOURS, at("2026-07-23T20:00:00Z"))).toEqual({
      isOpen: true,
      label: "Open now · til 10pm",
    });
  });

  it("reports open before midnight on an overnight session", () => {
    expect(describeOpenState(HOURS, at("2026-07-24T22:00:00Z"))).toEqual({
      isOpen: true,
      label: "Open now · til 1am",
    });
  });

  it("stays open after midnight on the previous day's overnight session", () => {
    expect(describeOpenState(HOURS, at("2026-07-24T23:30:00Z"))).toEqual({
      isOpen: true,
      label: "Open now · til 1am",
    });
  });

  it("closes once the overnight session ends", () => {
    const state = describeOpenState(HOURS, at("2026-07-25T01:30:00Z"));
    expect(state?.isOpen).toBe(false);
    expect(state?.label).toBe("Opens 3pm");
  });

  it("announces today's opening time when not open yet", () => {
    expect(describeOpenState(HOURS, at("2026-07-23T10:00:00Z"))).toEqual({
      isOpen: false,
      label: "Opens 7pm",
    });
  });

  it("rolls to the next open day when today is done", () => {
    expect(describeOpenState(HOURS, at("2026-07-23T21:30:00Z"))).toEqual({
      isOpen: false,
      label: "Opens Fri 3pm",
    });
  });

  it("skips closed days when looking ahead", () => {
    expect(describeOpenState(HOURS, at("2026-07-27T12:00:00Z"))).toEqual({
      isOpen: false,
      label: "Opens Thu 7pm",
    });
  });

  it("uses venue time, not UTC, across BST", () => {
    expect(describeOpenState(HOURS, at("2026-07-23T18:30:00Z"))).toEqual({
      isOpen: true,
      label: "Open now · til 10pm",
    });
  });

  it("returns null when there are no usable hours", () => {
    expect(describeOpenState({}, at("2026-07-23T20:00:00Z"))).toBeNull();
    expect(describeOpenState(null, at("2026-07-23T20:00:00Z"))).toBeNull();
    expect(
      describeOpenState({ monday: { open: "15:00" } }, at("2026-07-23T20:00:00Z"))
    ).toBeNull();
  });
});

describe("describeBarStatus", () => {
  it("says when the bar closes while it is open", () => {
    expect(describeBarStatus(HOURS, at("2026-07-23T20:00:00Z"))).toEqual({
      isOpen: true,
      label: "Open until 10pm",
      shortLabel: "Open til 10pm",
    });
  });

  it("keeps the closing time after midnight on an overnight session", () => {
    expect(describeBarStatus(HOURS, at("2026-07-24T23:30:00Z"))).toEqual({
      isOpen: true,
      label: "Open until 1am",
      shortLabel: "Open til 1am",
    });
  });

  it("gives today's opening time before the bar opens", () => {
    expect(describeBarStatus(HOURS, at("2026-07-23T10:00:00Z"))).toEqual({
      isOpen: false,
      label: "Open today from 7pm",
      shortLabel: "Opens 7pm",
    });
  });

  it("names the next open day in full once today is done", () => {
    expect(describeBarStatus(HOURS, at("2026-07-23T21:30:00Z"))).toEqual({
      isOpen: false,
      label: "Open Friday at 3pm",
      shortLabel: "Opens Fri 3pm",
    });
  });

  it("skips closed days when looking ahead", () => {
    expect(describeBarStatus(HOURS, at("2026-07-27T12:00:00Z"))).toEqual({
      isOpen: false,
      label: "Open Thursday at 7pm",
      shortLabel: "Opens Thu 7pm",
    });
  });

  it("returns null when there are no usable hours", () => {
    expect(describeBarStatus({}, at("2026-07-23T20:00:00Z"))).toBeNull();
    expect(describeBarStatus(null, at("2026-07-23T20:00:00Z"))).toBeNull();
  });
});

describe("shortLocation", () => {
  it("strips the postcode and keeps the last two segments", () => {
    expect(shortLocation("Unit 1, Regent St, Hinckley LE10 0BB")).toBe(
      "Regent St, Hinckley"
    );
  });

  it("handles a single-segment address", () => {
    expect(shortLocation("Hinckley LE10 0BB")).toBe("Hinckley");
  });

  it("handles an address with no postcode", () => {
    expect(shortLocation("Regent St, Hinckley")).toBe("Regent St, Hinckley");
  });

  it("returns null for empty input", () => {
    expect(shortLocation(null)).toBeNull();
    expect(shortLocation("")).toBeNull();
    expect(shortLocation("   ")).toBeNull();
  });
});
