import { describe, expect, it } from "vitest";
import { parseGovUkFeed } from "../bank-holidays";
import { cacheIsStale } from "../normal-units-server";

describe("parseGovUkFeed", () => {
  it("reads the England and Wales division and ignores malformed events", () => {
    const feed = {
      "england-and-wales": { events: [{ date: "2026-08-31", title: "Summer bank holiday" }, { title: "no date" }] },
      scotland: { events: [{ date: "2026-08-03", title: "Summer bank holiday" }] },
    };
    expect(parseGovUkFeed(feed)).toEqual([{ date: "2026-08-31", title: "Summer bank holiday" }]);
    expect(parseGovUkFeed(null)).toEqual([]);
  });
});

describe("cacheIsStale", () => {
  it("is stale when empty or older than a week", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(cacheIsStale(null, now)).toBe(true);
    expect(cacheIsStale(new Date("2026-09-09T12:00:00Z"), now)).toBe(true);
    expect(cacheIsStale(new Date("2026-09-12T12:00:00Z"), now)).toBe(false);
  });
});
