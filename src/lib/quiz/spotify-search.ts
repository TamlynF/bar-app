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
