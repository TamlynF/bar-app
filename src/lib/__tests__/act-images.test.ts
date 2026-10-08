import { describe, expect, it } from "vitest";
import {
  arrangePhotoRow,
  bookingsToAskAboutCover,
  coverUrlFromJoin,
  fitThumbnails,
  formatFollowers,
  shouldAskActCoverUpdate,
  type ActImage,
} from "../act-images";

function image(id: string, source: ActImage["source"], createdAt: string): ActImage {
  return {
    id,
    music_acts_id: "act",
    band_booking_request_id: null,
    url: `https://cdn.test/${id}.jpg`,
    storage_path: null,
    source,
    email_message_id: null,
    created_at: createdAt,
    created_by: null,
  };
}

describe("coverUrlFromJoin", () => {
  it("reads an object or a one-item array and ignores blanks", () => {
    expect(coverUrlFromJoin({ url: "a" })).toBe("a");
    expect(coverUrlFromJoin([{ url: "b" }])).toBe("b");
    expect(coverUrlFromJoin({ url: "  " })).toBeNull();
    expect(coverUrlFromJoin(null)).toBeNull();
    expect(coverUrlFromJoin([])).toBeNull();
  });
});

describe("formatFollowers", () => {
  it("rounds to a short figure", () => {
    expect(formatFollowers(0)).toBe("0");
    expect(formatFollowers(842)).toBe("842");
    expect(formatFollowers(1234)).toBe("1.2k");
    expect(formatFollowers(2000)).toBe("2k");
    expect(formatFollowers(45678)).toBe("46k");
    expect(formatFollowers(1500000)).toBe("1.5m");
    expect(formatFollowers(null)).toBeNull();
  });
});

describe("fitThumbnails", () => {
  it("counts whole tiles including the gaps between them", () => {
    expect(fitThumbnails(80, 80, 12)).toBe(1);
    expect(fitThumbnails(171, 80, 12)).toBe(1);
    expect(fitThumbnails(172, 80, 12)).toBe(2);
    expect(fitThumbnails(448, 80, 12)).toBe(5);
    expect(fitThumbnails(0, 80, 12)).toBe(1);
  });
});

describe("arrangePhotoRow", () => {
  const poster = image("poster", "upload", "2026-10-01T10:00:00Z");
  const insta = image("insta", "instagram", "2026-10-02T10:00:00Z");
  const olderInsta = image("insta-old", "instagram", "2026-09-02T10:00:00Z");
  const spotify = image("spotify", "spotify", "2026-10-03T10:00:00Z");
  const extra1 = image("extra1", "upload", "2026-10-04T10:00:00Z");
  const extra2 = image("extra2", "correspondence", "2026-10-05T10:00:00Z");
  const all = [extra2, extra1, spotify, olderInsta, insta, poster];

  it("puts the poster last, then the profile picture, then Spotify, then the rest", () => {
    const row = arrangePhotoRow(all, "poster", 10);
    expect(row.tiles.map((t) => (t.kind === "poster" ? "POSTER" : t.image.id))).toEqual([
      "extra2",
      "extra1",
      "insta-old",
      "spotify",
      "insta",
      "POSTER",
    ]);
    expect(row.overflow).toEqual([]);
    expect(row.tiles[4]).toMatchObject({ kind: "image", chip: "Instagram" });
    expect(row.tiles[3]).toMatchObject({ kind: "image", chip: "Spotify" });
  });

  it("always keeps a poster slot even when nothing is the poster", () => {
    const row = arrangePhotoRow([insta], null, 1);
    expect(row.tiles).toEqual([{ kind: "poster", image: null }]);
    expect(row.overflow.map((i) => i.id)).toEqual(["insta"]);
  });

  it("spills the leftmost pictures into the overflow when the row is full", () => {
    const row = arrangePhotoRow(all, "poster", 4);
    expect(row.tiles.map((t) => (t.kind === "poster" ? "POSTER" : t.image.id))).toEqual(["spotify", "insta", "POSTER"]);
    expect(row.overflow.map((i) => i.id)).toEqual(["extra2", "extra1", "insta-old"]);
  });

  it("labels a Messenger picture as Facebook", () => {
    const fb = image("fb", "messenger", "2026-10-06T10:00:00Z");
    const row = arrangePhotoRow([fb, poster], "poster", 5);
    expect(row.tiles[0]).toMatchObject({ kind: "image", chip: "Facebook" });
  });
});

describe("bookingsToAskAboutCover", () => {
  const today = "2026-10-08";
  const bookings = [
    { id: "past", group_name: "A", status: "booked", selected_date: "2026-10-01", cover_image_id: "old" },
    { id: "today", group_name: "A", status: "booked", selected_date: today, cover_image_id: "old" },
    { id: "future", group_name: "A", status: "offered", selected_date: "2026-11-01", cover_image_id: null },
    { id: "nodate", group_name: "A", status: "new", selected_date: null, cover_image_id: "old" },
    { id: "same", group_name: "A", status: "booked", selected_date: "2026-11-02", cover_image_id: "new" },
    { id: "declined", group_name: "A", status: "declined", selected_date: "2026-11-03", cover_image_id: "old" },
    { id: "cancelled", group_name: "A", status: "cancelled", selected_date: null, cover_image_id: "old" },
  ];

  it("keeps open bookings that are today, later or undated and not already on the new poster", () => {
    expect(bookingsToAskAboutCover(bookings, "new", today).map((b) => b.id)).toEqual(["today", "future", "nodate"]);
  });

  it("treats clearing the poster the same way", () => {
    expect(bookingsToAskAboutCover(bookings, null, today).map((b) => b.id)).toEqual(["today", "nodate", "same"]);
  });
});

describe("shouldAskActCoverUpdate", () => {
  it("asks only when the act already has a different poster", () => {
    expect(shouldAskActCoverUpdate(null, "x")).toBe(false);
    expect(shouldAskActCoverUpdate("x", "x")).toBe(false);
    expect(shouldAskActCoverUpdate("x", "y")).toBe(true);
    expect(shouldAskActCoverUpdate("x", null)).toBe(false);
  });
});
