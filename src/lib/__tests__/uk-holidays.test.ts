import { describe, expect, it } from "vitest";
import { ukBankHolidays, ukBankHolidaysBetween } from "../uk-holidays";

describe("ukBankHolidays", () => {
  it("matches the published England & Wales dates for 2026", () => {
    expect(ukBankHolidays(2026)).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-04",
      "2026-05-25",
      "2026-08-31",
      "2026-12-25",
      "2026-12-28",
    ]);
  });

  it("substitutes Christmas and Boxing Day when both fall on a weekend", () => {
    const holidays = ukBankHolidays(2021);
    expect(holidays).toContain("2021-12-27");
    expect(holidays).toContain("2021-12-28");
    expect(holidays).not.toContain("2021-12-25");
  });

  it("moves Christmas Day past Boxing Day when Christmas falls on a Sunday", () => {
    const holidays = ukBankHolidays(2022);
    expect(holidays).toContain("2022-12-26");
    expect(holidays).toContain("2022-12-27");
  });

  it("substitutes New Year's Day when it falls on a weekend", () => {
    expect(ukBankHolidays(2022)).toContain("2022-01-03");
  });
});

describe("ukBankHolidaysBetween", () => {
  it("spans years and clips to the range", () => {
    const set = ukBankHolidaysBetween("2026-12-01", "2027-01-31");
    expect(set.has("2026-12-25")).toBe(true);
    expect(set.has("2027-01-01")).toBe(true);
    expect(set.has("2026-08-31")).toBe(false);
  });
});
