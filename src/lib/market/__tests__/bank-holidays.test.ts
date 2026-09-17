import { describe, expect, it } from "vitest";
import { parseGovUkFeed } from "../bank-holidays";

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
