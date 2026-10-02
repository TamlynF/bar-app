export type SpotifyLink =
  | { kind: "artist"; id: string }
  | { kind: "short"; url: string }
  | { kind: "other"; type: string }
  | { kind: "invalid" };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SHORT_HOSTS = new Set(["spotify.link", "spotify.app.link"]);

export function spotifyArtistUrl(id: string): string {
  return `https://open.spotify.com/artist/${id}`;
}

/* Reads anything a band might paste from Spotify's Share menu: open.spotify.com
   links with or without a locale segment (/intl-gb/) and tracking query
   (?si=…), spotify: URIs, and the spotify.link short links the mobile app
   copies, which have to be followed on the server to find the artist. */
export function parseSpotifyLink(input: string): SpotifyLink {
  const text = input.trim();
  if (!text) return { kind: "invalid" };

  const uri = text.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/i);
  if (uri) {
    const [, type, id] = uri;
    if (type.toLowerCase() !== "artist") return { kind: "other", type: type.toLowerCase() };
    return SPOTIFY_ID.test(id) ? { kind: "artist", id } : { kind: "invalid" };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { kind: "invalid" };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (SHORT_HOSTS.has(host)) return { kind: "short", url: url.toString() };
  if (host !== "open.spotify.com" && host !== "play.spotify.com") return { kind: "invalid" };

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase().startsWith("intl-")) segments.shift();
  if (segments[0] === "embed") segments.shift();
  const [type, id] = segments;
  if (!type || !id) return { kind: "invalid" };
  if (type.toLowerCase() !== "artist") return { kind: "other", type: type.toLowerCase() };
  return SPOTIFY_ID.test(id) ? { kind: "artist", id } : { kind: "invalid" };
}

export function spotifyLinkError(link: SpotifyLink): string | null {
  if (link.kind === "other") {
    return `That's a Spotify ${link.type} link. Please use your artist profile link instead.`;
  }
  if (link.kind === "invalid") return "That doesn't look like a Spotify artist link.";
  return null;
}
