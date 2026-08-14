/* Words that say nothing about what a picture round is of. "Famous dog breeds"
   and "Dog breeds" are the same night; "Dog breeds" and "Cat breeds" are not. */
const IGNORED_WORDS = new Set([
  "a",
  "an",
  "and",
  "famous",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "picture",
  "pictures",
  "quiz",
  "round",
  "the",
  "to",
  "with",
]);

/* Crude singular: enough to tie "breeds" to "breed" without dragging in a
   stemming library, and short words are left alone so "gas" stays "gas". */
const singular = (word: string) =>
  word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;

export function topicTokens(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !IGNORED_WORDS.has(word))
    .map(singular)
    .filter((word) => !IGNORED_WORDS.has(word));
}

/* The words worth asking the database about - the rest of the matching happens
   here, on what comes back. */
export function topicSearchTokens(topic: string, limit = 5): string[] {
  return [...new Set(topicTokens(topic))].slice(0, limit);
}

/* Two topics are the same round if one names everything the other does, or if
   they share half the words between them. Deliberately generous: this drives a
   warning, and a topic seen before is worth a second thought either way. */
export function topicsOverlap(left: string, right: string): boolean {
  const a = new Set(topicTokens(left));
  const b = new Set(topicTokens(right));
  if (a.size === 0 || b.size === 0) return false;

  const shared = [...a].filter((word) => b.has(word)).length;
  if (shared === 0) return false;
  if (shared === Math.min(a.size, b.size)) return true;

  const union = new Set([...a, ...b]).size;
  return shared / union >= 0.5;
}
