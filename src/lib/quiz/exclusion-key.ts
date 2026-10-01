/* A turned-down question is matched on wording, not on punctuation or case:
   "What is the chemical symbol for Gold?" and "what is the chemical symbol for
   gold" are the same question to a guest. */
export function exclusionKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function withoutExcluded<T>(
  items: T[],
  identity: (item: T) => string,
  excludedKeys: ReadonlySet<string>
): T[] {
  if (!excludedKeys.size) return items;
  return items.filter((item) => !excludedKeys.has(exclusionKey(identity(item))));
}

/* A Higher-or-Lower batch offers five songs for one slot, and the four left
   over are usually fine songs from the wrong year - so they stay available
   unless the host says otherwise. Everywhere else an unpicked card is one the
   host chose not to use. */
export const neverShowByDefault = (isHigherLower: boolean): boolean => !isHigherLower;
