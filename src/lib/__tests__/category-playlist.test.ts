import { describe, it, expect } from "vitest";
import {
  pickCategoryPlaylist,
  playlistOwnerName,
  type CategoryPlaylistRow,
} from "@/lib/quiz/category-playlist";

const row = (
  employee_id: number | null,
  id: string,
  employees?: CategoryPlaylistRow["employees"]
): CategoryPlaylistRow => ({
  playlist_id: id,
  playlist_url: `https://open.spotify.com/playlist/${id}`,
  employee_id,
  employees,
});

describe("pickCategoryPlaylist", () => {
  it("returns nothing when the round has no playlist at all", () => {
    expect(pickCategoryPlaylist([], 7)).toBeNull();
  });

  it("prefers my own playlist over everyone else's", () => {
    const picked = pickCategoryPlaylist([row(3, "sarah"), row(7, "mine"), row(null, "legacy")], 7);
    expect(picked).toEqual({ row: expect.objectContaining({ playlist_id: "mine" }), isMine: true });
  });

  it("falls back to the ownerless legacy row when I have none", () => {
    const picked = pickCategoryPlaylist([row(3, "sarah"), row(null, "legacy")], 7);
    expect(picked?.row.playlist_id).toBe("legacy");
    expect(picked?.isMine).toBe(false);
  });

  it("falls back to a colleague's playlist when there is no legacy row", () => {
    const picked = pickCategoryPlaylist([row(3, "sarah")], 7);
    expect(picked?.row.playlist_id).toBe("sarah");
    expect(picked?.isMine).toBe(false);
  });

  it("never claims a playlist is mine when I have no employee record", () => {
    const picked = pickCategoryPlaylist([row(3, "sarah"), row(null, "legacy")], null);
    expect(picked?.isMine).toBe(false);
    expect(picked?.row.playlist_id).toBe("legacy");
  });

  it("does not treat a null employee_id row as belonging to a null employee id", () => {
    const picked = pickCategoryPlaylist([row(null, "legacy")], null);
    expect(picked?.isMine).toBe(false);
  });
});

describe("playlistOwnerName", () => {
  it("reads the name from an object join", () => {
    expect(playlistOwnerName(row(3, "a", { full_name: "Sarah Jones" }))).toBe("Sarah Jones");
  });

  it("reads the name from an array join", () => {
    expect(playlistOwnerName(row(3, "a", [{ full_name: "Sarah Jones" }]))).toBe("Sarah Jones");
  });

  it("is null for a legacy row with nobody attached", () => {
    expect(playlistOwnerName(row(null, "a"))).toBeNull();
    expect(playlistOwnerName(row(3, "a", []))).toBeNull();
    expect(playlistOwnerName(row(3, "a", { full_name: null }))).toBeNull();
  });
});
