import { describe, expect, it } from "vitest";
import { bookingGroupFor, groupBookingCards } from "../booking-hub-groups";

describe("bookingGroupFor", () => {
  it("files games by type and live music by behaviour", () => {
    expect(bookingGroupFor("games", "quiz")).toBe("pub_games");
    expect(bookingGroupFor("Games", "bingo")).toBe("pub_games");
    expect(bookingGroupFor("music", "music_act")).toBe("live_music");
    expect(bookingGroupFor("games", "music_act")).toBe("live_music");
    expect(bookingGroupFor("party", "standard")).toBe("featured_nights");
    expect(bookingGroupFor("music", "karaoke")).toBe("more");
    expect(bookingGroupFor(null, null)).toBe("more");
  });
});

describe("groupBookingCards", () => {
  it("keeps the fixed order, sorts by date and drops empty groups", () => {
    const groups = groupBookingCards([
      { group: "featured_nights" as const, date: "2026-12-01" },
      { group: "pub_games" as const, date: "2026-10-12" },
      { group: "pub_games" as const, date: "2026-10-08" },
      { group: "live_music" as const, date: null },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Pub Games", "Live Music", "Featured Nights"]);
    expect(groups[0].cards.map((c) => c.date)).toEqual(["2026-10-08", "2026-10-12"]);
  });
});
