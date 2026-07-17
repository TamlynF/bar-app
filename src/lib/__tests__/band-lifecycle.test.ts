import { describe, it, expect } from "vitest";
import { bandLifecycleStages, type BandLifecycleInput, type BandLifecycleRequest } from "../band-lifecycle";

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

/** The same, as a board entry. */
const req = (id: string, overrides: Partial<BandLifecycleInput> = {}): BandLifecycleRequest => ({
  id,
  ...booked(overrides),
});

/** Local-time instant, matching how the helper parses the DB's date strings. */
const at = (iso: string) => new Date(iso);

/** The stage of a request considered on its own — no siblings to compete with. */
const stageOf = (input: BandLifecycleInput, now: Date) =>
  bandLifecycleStages([{ id: "solo", ...input }], now).get("solo") ?? null;

describe("bandLifecycleStages", () => {
  describe("only booked requests with a linked event earn a badge", () => {
    it.each(["new", "reviewing", "offered", "declined"])("returns null for %s", (status) => {
      expect(stageOf(booked({ status }), at("2026-05-23T12:00:00"))).toBeNull();
    });

    it("tolerates casing and padding on the status", () => {
      expect(stageOf(booked({ status: " Booked " }), at("2026-05-23T12:00:00"))).toBe("completed");
    });

    it("returns null when no event was ever placed", () => {
      expect(stageOf(booked({ eventId: null }), at("2026-05-23T12:00:00"))).toBeNull();
    });

    it("returns null when the linked event has no date", () => {
      expect(stageOf(booked({ date: null }), at("2026-05-23T12:00:00"))).toBeNull();
    });
  });

  describe("overnight slots land on the right side of midnight", () => {
    // The regression this guards: comparing the bare end time 00:00 against the
    // wall clock marks a gig booked for tonight as finished from midnight on.
    it("is upcoming at midday on the day of the gig", () => {
      expect(stageOf(booked(), at("2026-05-22T12:00:00"))).toBe("upcoming");
    });

    it("shows nothing mid-performance", () => {
      expect(stageOf(booked(), at("2026-05-22T23:00:00"))).toBeNull();
    });

    it("is completed once the slot's end has passed, after midnight", () => {
      expect(stageOf(booked(), at("2026-05-23T00:30:00"))).toBe("completed");
    });

    it("is not yet completed at the very moment the slot ends", () => {
      expect(stageOf(booked(), at("2026-05-23T00:00:00"))).toBeNull();
    });

    it("is completed for a gig on a past date", () => {
      expect(stageOf(booked(), at("2026-06-01T12:00:00"))).toBe("completed");
    });
  });

  describe("times are only compared against the clock once the date arrives", () => {
    // A future gig must not drop off the badge purely because of the hour it's
    // viewed at — 22:00 next Friday is still upcoming when read at 23:00 tonight.
    it("stays upcoming when viewed later in the evening than the gig's start time", () => {
      expect(stageOf(booked({ date: "2026-05-29" }), at("2026-05-22T23:00:00"))).toBe("upcoming");
    });
  });

  describe("upcoming requires a live event, but has no horizon", () => {
    it("returns null for a future gig whose event is off the schedule", () => {
      expect(stageOf(booked({ eventIsActive: false }), at("2026-05-22T12:00:00"))).toBeNull();
    });

    it("is upcoming for a gig months out when it's the only one booked", () => {
      expect(stageOf(booked({ date: "2026-08-22" }), at("2026-05-22T12:00:00"))).toBe("upcoming");
    });

    it("is upcoming for a gig years out when it's the only one booked", () => {
      expect(stageOf(booked({ date: "2029-01-05" }), at("2026-05-22T12:00:00"))).toBe("upcoming");
    });
  });

  describe("a past event still reads completed once deactivated", () => {
    // Whether the event was later pulled off the schedule says nothing about
    // whether the night happened.
    it("is completed even when the linked event is inactive", () => {
      expect(stageOf(booked({ eventIsActive: false }), at("2026-06-01T12:00:00"))).toBe("completed");
    });
  });

  describe("missing times degrade sensibly", () => {
    it("treats a slot with no end as a point in time", () => {
      const input = booked({ endTime: null });
      expect(stageOf(input, at("2026-05-22T21:00:00"))).toBe("upcoming");
      expect(stageOf(input, at("2026-05-22T22:30:00"))).toBe("completed");
    });

    it("treats a date with no times at all as spanning the whole day", () => {
      const input = booked({ startTime: null, endTime: null });
      expect(stageOf(input, at("2026-05-21T12:00:00"))).toBe("upcoming");
      expect(stageOf(input, at("2026-05-22T12:00:00"))).toBeNull();
      expect(stageOf(input, at("2026-05-23T00:30:00"))).toBe("completed");
    });

    it("handles a same-day daytime slot", () => {
      const input = booked({ startTime: "14:00:00+00", endTime: "16:00:00+00" });
      expect(stageOf(input, at("2026-05-22T13:00:00"))).toBe("upcoming");
      expect(stageOf(input, at("2026-05-22T15:00:00"))).toBeNull();
      expect(stageOf(input, at("2026-05-22T16:30:00"))).toBe("completed");
    });
  });

  describe("exactly one request is upcoming — the next night on the schedule", () => {
    const now = at("2026-05-22T12:00:00");

    it("tags only the soonest of several future gigs", () => {
      const stages = bandLifecycleStages(
        [
          req("far", { date: "2026-07-31" }),
          req("soon", { date: "2026-05-24" }),
          req("mid", { date: "2026-06-27" }),
        ],
        now
      );
      expect(stages.get("soon")).toBe("upcoming");
      expect(stages.get("mid")).toBeUndefined();
      expect(stages.get("far")).toBeUndefined();
    });

    it("does not depend on the order the board hands them over", () => {
      const ascending = bandLifecycleStages([req("a", { date: "2026-05-24" }), req("b", { date: "2026-06-27" })], now);
      const descending = bandLifecycleStages([req("b", { date: "2026-06-27" }), req("a", { date: "2026-05-24" })], now);
      expect(ascending.get("a")).toBe("upcoming");
      expect(descending.get("a")).toBe("upcoming");
    });

    it("separates two gigs on the same night by their start time", () => {
      const stages = bandLifecycleStages(
        [
          req("late", { date: "2026-05-24", startTime: "22:00:00+00", endTime: "00:00:00+00" }),
          req("early", { date: "2026-05-24", startTime: "19:00:00+00", endTime: "21:00:00+00" }),
        ],
        now
      );
      expect(stages.get("early")).toBe("upcoming");
      expect(stages.get("late")).toBeUndefined();
    });

    it("skips a nearer gig whose event is off the schedule, in favour of the next live one", () => {
      const stages = bandLifecycleStages(
        [req("dead", { date: "2026-05-24", eventIsActive: false }), req("live", { date: "2026-06-27" })],
        now
      );
      expect(stages.get("dead")).toBeUndefined();
      expect(stages.get("live")).toBe("upcoming");
    });

    it("passes over a gig that's already underway", () => {
      const stages = bandLifecycleStages(
        [
          req("onstage", { date: "2026-05-22", startTime: "11:00:00+00", endTime: "14:00:00+00" }),
          req("next", { date: "2026-05-24" }),
        ],
        at("2026-05-22T12:00:00")
      );
      expect(stages.get("onstage")).toBeUndefined();
      expect(stages.get("next")).toBe("upcoming");
    });

    it("still marks every finished gig completed, however many there are", () => {
      const stages = bandLifecycleStages(
        [req("gone", { date: "2026-01-10" }), req("also-gone", { date: "2026-02-14" }), req("next", { date: "2026-05-24" })],
        now
      );
      expect(stages.get("gone")).toBe("completed");
      expect(stages.get("also-gone")).toBe("completed");
      expect(stages.get("next")).toBe("upcoming");
    });

    it("tags nothing upcoming when every booked gig is behind us", () => {
      const stages = bandLifecycleStages([req("gone", { date: "2026-01-10" }), req("also-gone", { date: "2026-02-14" })], now);
      expect([...stages.values()]).toEqual(["completed", "completed"]);
    });

    it("returns an empty map for an empty board", () => {
      expect(bandLifecycleStages([], now).size).toBe(0);
    });

    // A tie is only reachable via two events at the identical instant, which the
    // clash check is meant to prevent — but the badge must still land on exactly
    // one card rather than both.
    it("gives a dead heat to a single request", () => {
      const stages = bandLifecycleStages([req("a", { date: "2026-05-24" }), req("b", { date: "2026-05-24" })], now);
      expect([...stages.values()]).toEqual(["upcoming"]);
    });
  });
});
