import { parseSpotifyLink, spotifyArtistUrl, spotifyLinkError } from "@/lib/spotify-link";

export type SpotifyArtist = {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  followers: number | null;
};

type ApiArtist = {
  id: string;
  name: string;
  images?: { url: string; width: number | null }[];
  followers?: { total: number | null };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

/* App-level token (client credentials): public catalogue reads only, no user
   account involved. Cached until a minute before Spotify expires it. */
async function appToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

async function spotifyGet<T>(path: string): Promise<T | null> {
  const token = await appToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) cachedToken = null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toArtist(artist: ApiArtist): SpotifyArtist {
  const images = [...(artist.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const image = images.find((i) => (i.width ?? 0) >= 160) ?? images[images.length - 1];
  return {
    id: artist.id,
    name: artist.name,
    url: spotifyArtistUrl(artist.id),
    imageUrl: image?.url ?? null,
    followers: artist.followers?.total ?? null,
  };
}

export async function searchSpotifyArtists(query: string, limit = 6): Promise<SpotifyArtist[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const data = await spotifyGet<{ artists?: { items?: ApiArtist[] } }>(
    `/search?type=artist&limit=${limit}&q=${encodeURIComponent(q)}`
  );
  return (data?.artists?.items ?? []).map(toArtist);
}

export async function getSpotifyArtist(id: string): Promise<SpotifyArtist | null> {
  const data = await spotifyGet<ApiArtist>(`/artists/${encodeURIComponent(id)}`);
  return data?.id ? toArtist(data) : null;
}

async function followShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    return res.url || null;
  } catch {
    return null;
  }
}

/* Turns whatever was pasted into the artist it points at, or a message saying
   why it can't. Short links are followed once to their open.spotify.com page. */
export async function resolveSpotifyArtistLink(
  input: string
): Promise<{ artist: SpotifyArtist } | { error: string }> {
  let link = parseSpotifyLink(input);
  if (link.kind === "short") {
    const target = await followShortLink(link.url);
    link = target ? parseSpotifyLink(target) : { kind: "invalid" };
  }
  if (link.kind !== "artist") return { error: spotifyLinkError(link) ?? "That doesn't look like a Spotify artist link." };
  const artist = await getSpotifyArtist(link.id);
  return artist ? { artist } : { error: "We couldn't find that artist on Spotify." };
}
