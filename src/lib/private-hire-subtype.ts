// Helpers for resolving a private-hire enquiry's event subtype to a display label.
// Pure (no Supabase) so the label logic can be unit-tested.

export type PrivateHireSubtype = {
  id: number;
  name: string;
  default_event_title: string | null;
};

/** Supabase joins can come back as an object OR a single-element array — normalise. */
export function unwrapSubtype<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

/** Capitalise each word, e.g. "wedding reception" → "Wedding Reception". */
function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Display label for a private-hire enquiry's event subtype: the subtype's
 * `default_event_title` when set, otherwise its `name`. Falls back to `fallback`
 * (e.g. the legacy `reason_for_hire`) when there's no linked subtype.
 */
export function privateHireSubtypeLabel(
  subtype: { name?: string | null; default_event_title?: string | null } | null | undefined,
  fallback = ""
): string {
  const title = subtype?.default_event_title?.trim();
  if (title) return toTitleCase(title);
  const name = subtype?.name?.trim();
  if (name) return toTitleCase(name);
  return fallback;
}
