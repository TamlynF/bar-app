import { describe, expect, it } from "vitest";
import { mapWithLimit, primaryArtist, spotifySearchQueries } from "@/lib/quiz/spotify-search";

describe("primaryArtist", () => {
  it("drops featured artists however they are credited", () => {
    expect(primaryArtist("Dr. Dre ft. Snoop Dogg")).toBe("Dr. Dre");
    expect(primaryArtist("Eminem feat. Rihanna")).toBe("Eminem");
    expect(primaryArtist("Queen & David Bowie")).toBe("Queen");
    expect(primaryArtist("Run-DMC, Aerosmith")).toBe("Run-DMC");
    expect(primaryArtist("Jay-Z featuring Alicia Keys")).toBe("Jay-Z");
  });

  it("leaves a single artist alone", () => {
    expect(primaryArtist("Pearl Jam")).toBe("Pearl Jam");
    expect(primaryArtist("Florence + The Machine")).toBe("Florence + The Machine");
  });
});

describe("spotifySearchQueries", () => {
  it("tries the strict query, then the lead artist, then free text", () => {
    expect(spotifySearchQueries("Dr. Dre ft. Snoop Dogg", "Nuthin' but a 'G' Thang")).toEqual([
      "track:Nuthin but a G Thang artist:Dr. Dre ft. Snoop Dogg",
      "track:Nuthin but a G Thang artist:Dr. Dre",
      "Nuthin but a G Thang Dr. Dre",
    ]);
  });

  it("does not repeat a query when there is no featured artist", () => {
    expect(spotifySearchQueries("Pearl Jam", "Jeremy")).toEqual([
      "track:Jeremy artist:Pearl Jam",
      "Jeremy Pearl Jam",
    ]);
  });
});

describe("mapWithLimit", () => {
  it("keeps results in input order", async () => {
    const out = await mapWithLimit([30, 10, 20], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    await mapWithLimit([1, 2, 3, 4, 5, 6], 2, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapWithLimit([], 3, async (x) => x)).toEqual([]);
  });
});
