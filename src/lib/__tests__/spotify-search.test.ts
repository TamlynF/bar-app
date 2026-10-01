import { describe, expect, it } from "vitest";
import { introSeconds, mapWithLimit, pickStudioTrack, primaryArtist, spotifySearchQueries } from "@/lib/quiz/spotify-search";

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

describe("pickStudioTrack", () => {
  const track = (id: string, name: string, artist: string, album = "Album", album_type = "album") => ({
    id,
    name,
    artists: [{ name: artist }],
    album: { name: album, album_type },
  });

  it("skips a live version that ranks first", () => {
    const items = [
      track("live", "Mr. Brightside - Live", "The Killers"),
      track("studio", "Mr. Brightside", "The Killers"),
    ];
    expect(pickStudioTrack(items, "The Killers", "Mr. Brightside")?.id).toBe("studio");
  });

  it("skips tracks from a live album", () => {
    const items = [
      track("live", "Back In Black", "AC/DC", "Live at River Plate"),
      track("studio", "Back In Black", "AC/DC", "Back In Black"),
    ];
    expect(pickStudioTrack(items, "AC/DC", "Back In Black")?.id).toBe("studio");
  });

  it("skips remixes, radio edits and demos", () => {
    const items = [
      track("remix", "Blue Monday - 2016 Remix", "New Order"),
      track("edit", "Blue Monday - Radio Edit", "New Order"),
      track("studio", "Blue Monday", "New Order"),
    ];
    expect(pickStudioTrack(items, "New Order", "Blue Monday")?.id).toBe("studio");
  });

  it("keeps a remaster of the studio recording", () => {
    const items = [track("remaster", "Layla - 2010 Remastered", "Derek & The Dominos")];
    expect(pickStudioTrack(items, "Derek & The Dominos", "Layla")?.id).toBe("remaster");
  });

  it("does not reject a word that is part of the title asked for", () => {
    const items = [track("bond", "Live And Let Die", "Wings")];
    expect(pickStudioTrack(items, "Wings", "Live and Let Die")?.id).toBe("bond");
  });

  it("prefers the right artist over a cover", () => {
    const items = [
      track("cover", "Smells Like Teen Spirit", "Some Band"),
      track("original", "Smells Like Teen Spirit", "Nirvana"),
    ];
    expect(pickStudioTrack(items, "Nirvana", "Smells Like Teen Spirit")?.id).toBe("original");
  });

  it("prefers an album over a compilation", () => {
    const items = [
      track("comp", "Sweet Child O' Mine", "Guns N' Roses", "Greatest Hits", "compilation"),
      track("album", "Sweet Child O' Mine", "Guns N' Roses", "Appetite for Destruction"),
    ];
    expect(pickStudioTrack(items, "Guns N' Roses", "Sweet Child O' Mine")?.id).toBe("album");
  });

  it("returns null when only non-studio versions exist", () => {
    const items = [track("live", "Wonderwall - Live", "Oasis")];
    expect(pickStudioTrack(items, "Oasis", "Wonderwall")).toBeNull();
  });
});

describe("introSeconds", () => {
  it("reads the leading m:ss", () => {
    expect(introSeconds("0:12 - rising organ line")).toBe(12);
    expect(introSeconds("1:05 - long synth build")).toBe(65);
  });

  it("returns null when no time leads the description", () => {
    expect(introSeconds("Rising organ line")).toBeNull();
    expect(introSeconds(null)).toBeNull();
  });
});
