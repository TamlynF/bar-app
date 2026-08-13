import { cookies } from "next/headers";

const API = "https://api.spotify.com/v1";

export class SpotifyScopeError extends Error {}
export class SpotifyNotConnectedError extends Error {}

async function refreshUserToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;
  if (!refreshToken) return null;

  const clientId = process.env.SPOTIFY_CLIENT_ID || "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) return null;

  const tokens = await res.json();
  try {
    cookieStore.set("spotify_access_token", tokens.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in || 3600,
    });
    if (tokens.refresh_token) {
      cookieStore.set("spotify_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  } catch {
  }
  return tokens.access_token as string;
}

export async function getUserSpotifyToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("spotify_access_token")?.value ?? null;
}

async function spotifyUserFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = (await getUserSpotifyToken()) ?? (await refreshUserToken());
  if (!token) throw new SpotifyNotConnectedError();

  const doFetch = (t: string) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshUserToken();
    if (!refreshed) throw new SpotifyNotConnectedError();
    res = await doFetch(refreshed);
  }
  if (res.status === 403) throw new SpotifyScopeError();
  return res;
}

export async function getCurrentUserId(): Promise<string> {
  const res = await spotifyUserFetch("/me");
  if (!res.ok) throw new Error(`Spotify /me failed (${res.status})`);
  const data = await res.json();
  return data.id as string;
}

export async function createPublicPlaylist(userId: string, name: string): Promise<{ id: string; url: string }> {
  const res = await spotifyUserFetch(`/users/${encodeURIComponent(userId)}/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, public: true }),
  });
  if (!res.ok) throw new Error(`Spotify create playlist failed (${res.status})`);
  const data = await res.json();
  return { id: data.id, url: data.external_urls?.spotify ?? `https://open.spotify.com/playlist/${data.id}` };
}

/* Spotify answers 403 both for a missing scope and for "that playlist isn't
   yours", so the owner is what tells those two apart. Reading a public playlist
   needs no ownership, only a connected account. */
export async function getPlaylistOwner(
  playlistId: string
): Promise<{ id: string; name: string } | null> {
  const res = await spotifyUserFetch(`/playlists/${playlistId}?fields=owner(id,display_name)`);
  if (!res.ok) return null;
  const data = await res.json();
  const owner = data?.owner;
  return owner?.id ? { id: owner.id, name: owner.display_name || owner.id } : null;
}

export async function replacePlaylistTracks(playlistId: string, uris: string[]): Promise<void> {
  const res = await spotifyUserFetch(`/playlists/${playlistId}/tracks`, {
    method: "PUT",
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) throw new Error(`Spotify replace tracks failed (${res.status})`);
}
