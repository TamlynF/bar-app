export type PrivateHireSubtype = {
  id: number;
  name: string;
  default_event_title: string | null;
};

export function unwrapSubtype<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

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
