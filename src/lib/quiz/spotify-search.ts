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
