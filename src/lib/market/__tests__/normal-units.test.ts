import { describe, expect, it } from "vitest";
import {
  addDays,
  isBankHolidayNight,
  nightOf,
  profileWeekdayFor,
  resolveNormalUnits,
  sampleNightDates,
  samplesFromLines,
  sessionTicksFor,
  summariseSamples,
  toYmd,
  tradingNightOf,
  weekdayOf,
  zonedTimeToUtc,
} from "../normal-units";

describe("calendar helpers", () => {
  it("knows weekdays and day arithmetic without a timezone slip", () => {
    expect(weekdayOf("2026-09-19")).toBe(6);
    expect(weekdayOf("2026-09-20")).toBe(0);
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("converts London wall-clock to instants across BST and GMT", () => {
    expect(zonedTimeToUtc("2026-07-04", "20:00").toISOString()).toBe("2026-07-04T19:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-05", "20:00").toISOString()).toBe("2026-12-05T20:00:00.000Z");
  });

  it("reads the London calendar date", () => {
    expect(toYmd(new Date("2026-09-19T23:30:00Z"))).toBe("2026-09-20");
    expect(toYmd(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31");
  });
});

describe("tradingNightOf", () => {
  it("keeps evening sales on their date and rolls the small hours back to the night before", () => {
    expect(tradingNightOf(new Date("2026-09-19T22:50:00Z"))).toBe("2026-09-19");
    expect(tradingNightOf(new Date("2026-09-20T00:45:00Z"))).toBe("2026-09-19");
    expect(tradingNightOf(new Date("2026-09-20T04:59:00Z"))).toBe("2026-09-19");
    expect(tradingNightOf(new Date("2026-09-20T05:00:00Z"))).toBe("2026-09-20");
    expect(tradingNightOf(new Date("2026-09-20T10:00:00Z"))).toBe("2026-09-20");
  });

  it("uses London time either side of the clock changes", () => {
    expect(tradingNightOf(new Date("2026-10-25T05:30:00Z"))).toBe("2026-10-24");
    expect(tradingNightOf(new Date("2026-10-25T06:00:00Z"))).toBe("2026-10-25");
    expect(tradingNightOf(new Date("2026-03-29T04:30:00Z"))).toBe("2026-03-28");
    expect(tradingNightOf(new Date("2026-03-29T05:00:00Z"))).toBe("2026-03-29");
  });

  it("assigns a session to the night it opened on, even after midnight", () => {
    expect(nightOf(new Date("2026-09-19T20:30:00Z"))).toBe("2026-09-19");
    expect(nightOf(new Date("2026-09-19T23:30:00Z"))).toBe("2026-09-19");
  });
});

describe("sampleNightDates", () => {
  it("returns the most recent same-weekday nights before today, newest first", () => {
    const dates = sampleNightDates(6, { today: "2026-09-19", count: 3 });
    expect(dates).toEqual(["2026-09-12", "2026-09-05", "2026-08-29"]);
  });

  it("respects the lookback and exclusions", () => {
    expect(sampleNightDates(6, { today: "2026-09-19", count: 6, lookbackWeeks: 2 })).toEqual(["2026-09-12", "2026-09-05"]);
    expect(sampleNightDates(6, { today: "2026-09-19", count: 2, exclude: new Set(["2026-09-12"]) })).toEqual(["2026-09-05", "2026-08-29"]);
  });

  it("covers twelve weeks by default", () => {
    expect(sampleNightDates(6, { today: "2026-09-19", count: 20 })).toHaveLength(12);
  });
});

describe("bank holidays", () => {
  const holidays = new Set(["2026-08-31"]);

  it("treats a bank-holiday eve as the profile weekday and keeps both dates out of normals", () => {
    expect(profileWeekdayFor("2026-08-30", holidays, 6)).toBe(6);
    expect(profileWeekdayFor("2026-08-30", holidays, null)).toBe(0);
    expect(profileWeekdayFor("2026-08-29", holidays, 6)).toBe(6);
    expect(isBankHolidayNight("2026-08-30", holidays)).toBe(true);
    expect(isBankHolidayNight("2026-08-31", holidays)).toBe(true);
    expect(isBankHolidayNight("2026-08-29", holidays)).toBe(false);
  });
});

describe("samplesFromLines and summariseSamples", () => {
  it("groups synced lines by night and leaves a night with no lines empty", () => {
    const samples = samplesFromLines(
      ["2026-09-12", "2026-09-05"],
      [
        { tradingNight: "2026-09-12", variationId: "G", quantity: "2" },
        { tradingNight: "2026-09-12", variationId: "G", quantity: 3 },
        { tradingNight: "2026-09-12", variationId: "X", quantity: 1 },
        { tradingNight: "2026-09-12", variationId: null, quantity: 4 },
        { tradingNight: "2026-08-29", variationId: "G", quantity: 9 },
      ]
    );
    expect(samples).toHaveLength(2);
    expect(samples[0].units.get("G")).toBe(5);
    expect(samples[0].units.get("X")).toBe(1);
    expect(samples[1].units.size).toBe(0);
  });

  it("averages over open nights, counts a zero night, drops closed nights and unmapped variations", () => {
    const map = new Map([
      ["G", 22],
      ["O", 38],
    ]);
    const rows = summariseSamples(
      6,
      [
        { night: "2026-09-12", units: new Map([["G", 40], ["X", 5]]) },
        { night: "2026-09-05", units: new Map([["O", 4]]) },
        { night: "2026-08-29", units: new Map() },
      ],
      map
    );
    const byId = new Map(rows.map((r) => [r.menuItemPriceId, r]));
    expect(byId.get(22)).toMatchObject({ unitsAvg: 20, nightsSampled: 2, weekday: 6 });
    expect(byId.get(38)).toMatchObject({ unitsAvg: 2, nightsSampled: 2 });
    expect(byId.get(22)!.sampledDates).toEqual(["2026-09-12", "2026-09-05"]);
  });
});

describe("resolveNormalUnits", () => {
  const cache = new Map([
    [22, [
      { menuItemPriceId: 22, weekday: 5, unitsAvg: 30, nightsSampled: 6, sampledDates: [] },
      { menuItemPriceId: 22, weekday: 6, unitsAvg: 46, nightsSampled: 5, sampledDates: [] },
    ]],
  ]);
  const config = { paceFloorUnits: 8 };

  it("prefers the override, then the profile weekday, then another weekday, then the floor", () => {
    expect(resolveNormalUnits(22, 6, 50, cache, config)).toEqual({ value: 50, source: { kind: "override" } });
    expect(resolveNormalUnits(22, 6, null, cache, config)).toEqual({ value: 46, source: { kind: "square", weekday: 6, nightsSampled: 5 } });
    expect(resolveNormalUnits(22, 2, null, cache, config)).toEqual({
      value: 30,
      source: { kind: "square_other_weekday", weekday: 5, nightsSampled: 6 },
    });
    expect(resolveNormalUnits(99, 6, null, cache, config)).toEqual({ value: 8, source: { kind: "fallback" } });
    expect(resolveNormalUnits(22, 6, 0, cache, config).source.kind).toBe("square");
  });
});

describe("sessionTicksFor", () => {
  it("counts the ticks in a night, including one that crosses midnight", () => {
    expect(sessionTicksFor("19:00", "23:30", 60)).toBe(270);
    expect(sessionTicksFor("20:00", "02:00", 60)).toBe(360);
    expect(sessionTicksFor("20:00", "02:00", 120)).toBe(180);
  });
});
