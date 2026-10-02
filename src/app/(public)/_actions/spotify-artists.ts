"use server";

import { resolveSpotifyArtistLink, searchSpotifyArtists, type SpotifyArtist } from "@/lib/spotify-artists";

export async function findSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  return searchSpotifyArtists(query);
}

export async function lookupSpotifyArtist(link: string): Promise<{ artist: SpotifyArtist } | { error: string }> {
  return resolveSpotifyArtistLink(link);
}
