import { describe, it, expect } from "vitest";
import { bandLifecycleStage, type BandLifecycleInput } from "../band-lifecycle";

/** A booked request whose event sits on 22 May, 22:00–00:00 — the common case. */
const booked = (overrides: Partial<BandLifecycleInput> = {}): BandLifecycleInput => ({
  status: "booked",
  eventId: 42,
  eventIsActive: true,
  date: "2026-05-22",
  startTime: "22:00:00+00",
  endTime: "00:00:00+00",
  ...overrides,
});

/** Local-time instant, matching how the helper parses the DB's date strings. */
const at = (iso: string) => new Date(iso);

describe("bandLifecycleStage", () => {
  describe("only booked requests with a linked event earn a badge", () => {
    it.each(["new", "reviewing", "offered", "declined"])("returns null for %s", (status) => {
      expect(bandLifecycleStage(booked({ status }), at("2026-05-23T12:00:00"))).toBeNull();
    });

    it("tolerates casing and padding on the status", () => {
      expect(bandLifecycleStage(booked({ status: " Booked " }), at("2026-05-23T12:00:00"))).toBe("completed");
    });

    it("returns null when no event was ever placed", () => {
      expect(bandLifecycleStage(booked({ eventId: null }), at("2026-05-23T12:00:00"))).toBeNull();
    });

    it("returns null when the linked event has no date", () => {
      expect(bandLifecycleStage(booked({ date: null }), at("2026-05-23T12:00:00"))).toBeNull();
    });
  });

  describe("overnight slots land on the right side of midnight", () => {
    // The regression this guards: comparing the bare end time 00:00 against the
    // wall clock marks a gig booked for tonight as finished from midnight on.
    it("is upcoming at midday on the day of the gig", () => {
      expect(bandLifecycleStage(booked(), at("2026-05-22T12:00:00"))).toBe("upcoming");
    });

    it("shows nothing mid-performance", () => {
      expect(bandLifecycleStage(booked(), at("2026-05-22T23:00:00"))).toBeNull();
    });

    it("is completed once the slot's end has passed, after midnight", () => {
      expect(bandLifecycleStage(booked(), at("2026-05-23T00:30:00"))).toBe("completed");
    });

    it("is not yet completed at the very moment the slot ends", () => {
      expect(bandLifecycleStage(booked(), at("2026-05-23T00:00:00"))).toBeNull();
    });

    it("is completed for a gig on a past date", () => {
      expect(bandLifecycleStage(booked(), at("2026-06-01T12:00:00"))).toBe("completed");
    });
  });

  describe("times are only compared against the clock once the date arrives", () => {
    // A future gig must not drop off the badge purely because of the hour it's
    // viewed at — 22:00 next Friday is still upcoming when read at 23:00 tonight.
    it("stays upcoming when viewed later in the evening than the gig's start time", () => {
      expect(bandLifecycleStage(booked({ date: "2026-05-29" }), at("2026-05-22T23:00:00"))).toBe("upcoming");
    });
  });

  describe("upcoming is bounded and requires a live event", () => {
    it("returns null for a future gig whose event is off the schedule", () => {
      expect(bandLifecycleStage(booked({ eventIsActive: false }), at("2026-05-22T12:00:00"))).toBeNull();
    });

    it("is upcoming on the last day of the horizon", () => {
      expect(bandLifecycleStage(booked({ date: "2026-06-22" }), at("2026-05-22T12:00:00"))).toBe("upcoming");
    });

    it("returns null just beyond the horizon", () => {
      expect(bandLifecycleStage(booked({ date: "2026-06-23" }), at("2026-05-22T12:00:00"))).toBeNull();
    });

    it("returns null for a gig months out", () => {
      expect(bandLifecycleStage(booked({ date: "2026-08-22" }), at("2026-05-22T12:00:00"))).toBeNull();
    });
  });

  describe("a past event still reads completed once deactivated", () => {
    // Whether the event was later pulled off the schedule says nothing about
    // whether the night happened.
    it("is completed even when the linked event is inactive", () => {
      expect(bandLifecycleStage(booked({ eventIsActive: false }), at("2026-06-01T12:00:00"))).toBe("completed");
    });
  });

  describe("missing times degrade sensibly", () => {
    it("treats a slot with no end as a point in time", () => {
      const input = booked({ endTime: null });
      expect(bandLifecycleStage(input, at("2026-05-22T21:00:00"))).toBe("upcoming");
      expect(bandLifecycleStage(input, at("2026-05-22T22:30:00"))).toBe("completed");
    });

    it("treats a date with no times at all as spanning the whole day", () => {
      const input = booked({ startTime: null, endTime: null });
      expect(bandLifecycleStage(input, at("2026-05-21T12:00:00"))).toBe("upcoming");
      expect(bandLifecycleStage(input, at("2026-05-22T12:00:00"))).toBeNull();
      expect(bandLifecycleStage(input, at("2026-05-23T00:30:00"))).toBe("completed");
    });

    it("handles a same-day daytime slot", () => {
      const input = booked({ startTime: "14:00:00+00", endTime: "16:00:00+00" });
      expect(bandLifecycleStage(input, at("2026-05-22T13:00:00"))).toBe("upcoming");
      expect(bandLifecycleStage(input, at("2026-05-22T15:00:00"))).toBeNull();
      expect(bandLifecycleStage(input, at("2026-05-22T16:30:00"))).toBe("completed");
    });
  });
});
