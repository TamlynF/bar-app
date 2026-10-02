import { describe, expect, it } from "vitest";
import { parseSpotifyLink, spotifyArtistUrl, spotifyLinkError } from "@/lib/spotify-link";

const ID = "0TnOYISbd1XYRBk9myaseg";

describe("parseSpotifyLink", () => {
  it("reads artist links in the shapes Spotify shares them", () => {
    expect(parseSpotifyLink(`https://open.spotify.com/artist/${ID}`)).toEqual({ kind: "artist", id: ID });
    expect(parseSpotifyLink(`https://open.spotify.com/intl-gb/artist/${ID}?si=abc123`)).toEqual({ kind: "artist", id: ID });
    expect(parseSpotifyLink(`open.spotify.com/artist/${ID}`)).toEqual({ kind: "artist", id: ID });
    expect(parseSpotifyLink(`spotify:artist:${ID}`)).toEqual({ kind: "artist", id: ID });
    expect(parseSpotifyLink(`  https://open.spotify.com/embed/artist/${ID}  `)).toEqual({ kind: "artist", id: ID });
  });

  it("flags short links for the server to follow", () => {
    expect(parseSpotifyLink("https://spotify.link/AbCdEf123")).toEqual({
      kind: "short",
      url: "https://spotify.link/AbCdEf123",
    });
  });

  it("recognises playlists, tracks and albums as the wrong kind of link", () => {
    expect(parseSpotifyLink(`https://open.spotify.com/playlist/${ID}`)).toEqual({ kind: "other", type: "playlist" });
    expect(parseSpotifyLink(`https://open.spotify.com/track/${ID}?si=x`)).toEqual({ kind: "other", type: "track" });
    expect(parseSpotifyLink(`spotify:album:${ID}`)).toEqual({ kind: "other", type: "album" });
  });

  it("rejects anything that is not a Spotify artist link", () => {
    expect(parseSpotifyLink("")).toEqual({ kind: "invalid" });
    expect(parseSpotifyLink("https://example.com/artist/abc")).toEqual({ kind: "invalid" });
    expect(parseSpotifyLink("https://open.spotify.com/artist/too-short")).toEqual({ kind: "invalid" });
    expect(parseSpotifyLink("not a link at all")).toEqual({ kind: "invalid" });
  });
});

describe("spotifyLinkError", () => {
  it("explains wrong link types and passes artist links", () => {
    expect(spotifyLinkError({ kind: "other", type: "playlist" })).toMatch(/playlist link/);
    expect(spotifyLinkError({ kind: "invalid" })).toMatch(/doesn't look like/);
    expect(spotifyLinkError({ kind: "artist", id: ID })).toBeNull();
  });

  it("builds the canonical artist URL", () => {
    expect(spotifyArtistUrl(ID)).toBe(`https://open.spotify.com/artist/${ID}`);
  });
});
