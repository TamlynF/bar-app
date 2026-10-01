/* Spotify's fielded search is exact about the artist, and the model writes
   artists the way a pub would say them - "Dr. Dre ft. Snoop Dogg". The track
   is credited to Dr. Dre alone, so the strict query finds nothing and the
   card has no player. The queries below are tried in order until one hits. */

const FEATURED_SPLIT = /\s+(?:ft\.?|feat\.?|featuring|with|vs\.?|x|&|and)\s+|,\s+/i;

export function primaryArtist(artist: string): string {
  return artist.split(FEATURED_SPLIT)[0]?.trim() || artist.trim();
}

/* Quotes inside a fielded term end the term early, so the title goes in
   without them. */
function fieldSafe(value: string): string {
  return value.replace(/["']/g, "").trim();
}

export function spotifySearchQueries(artist: string, title: string): string[] {
  const cleanTitle = fieldSafe(title);
  const fullArtist = fieldSafe(artist);
  const leadArtist = fieldSafe(primaryArtist(artist));

  const queries = [
    `track:${cleanTitle} artist:${fullArtist}`,
    `track:${cleanTitle} artist:${leadArtist}`,
    `${cleanTitle} ${leadArtist}`,
  ];

  return queries.filter((query, index) => query.trim() && queries.indexOf(query) === index);
}

/* Searching without a market can pick a release that is not licensed where the
   venue plays, and that track then refuses to play on the night. */
export const SPOTIFY_MARKET = "GB";

/* A batch of songs searched all at once trips Spotify's rate limit, and a
   rate-limited search reads as "no match" - the card loses its player. This
   runs the work a few at a time, keeping results in input order. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runner = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

export type SpotifySearchTrack = {
  id: string;
  name: string;
  artists?: { name: string }[];
  album?: { name?: string; album_type?: string };
};

/* Versions whose opening is not the studio recording's - a crowd, a count-in,
   studio chatter, a DJ, a re-cut intro. Only rejected when the song asked for
   does not itself carry the word, so "Live and Let Die" still matches. */
const NON_STUDIO = /\b(live|remix|mix|demo|acoustic|unplugged|karaoke|commentary|interview|skit|session|sessions|rehearsal|take|edit|video|instrumental|cover|tribute)\b/i;

const plainWords = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function isNonStudio(track: SpotifySearchTrack, title: string): boolean {
  const asked = plainWords(title);
  const words = `${track.name} ${track.album?.name ?? ""}`.match(new RegExp(NON_STUDIO.source, "gi")) ?? [];
  return words.some((word) => !asked.split(" ").includes(word.toLowerCase()));
}

/* Spotify's first hit is often a live cut or a remix of the song asked for, and
   the quiz plays from 0:00 - so the pick is the closest studio recording. A
   title match beats a near miss, the right artist beats a cover, and an album
   or single beats a compilation. No studio candidate at all means no track. */
export function pickStudioTrack<T extends SpotifySearchTrack>(
  items: T[],
  artist: string,
  title: string
): T | null {
  const wantTitle = plainWords(title);
  const wantArtist = plainWords(primaryArtist(artist));
  let best: { track: T; score: number } | null = null;

  for (const [index, track] of items.entries()) {
    if (!track?.id || isNonStudio(track, title)) continue;
    const name = plainWords(track.name).replace(/\s*remaster(ed)?\b.*$/, "").trim();
    const artists = (track.artists ?? []).map((a) => plainWords(a.name));

    let score = -index;
    if (name === wantTitle) score += 100;
    else if (name.startsWith(wantTitle)) score += 40;
    if (artists.some((a) => a === wantArtist || a.includes(wantArtist) || wantArtist.includes(a))) score += 50;
    if (track.album?.album_type === "compilation") score -= 20;

    if (!best || score > best.score) best = { track, score };
  }
  return best?.track ?? null;
}

/* The model is asked to open intro_description with the intro's length, e.g.
   "0:12 - rising organ line". Null when it did not. */
export function introSeconds(description: string | null | undefined): number | null {
  const match = (description ?? "").trim().match(/^~?(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export const MIN_INSTRUMENTAL_INTRO_SECONDS = 8;
