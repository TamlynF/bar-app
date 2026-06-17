// Pure helpers for the band-booking time-slot clash check. Kept free of Supabase
// so the overlap logic can be unit-tested; the server action just feeds it the
// active events for a date.

/** Parse "HH:MM", "HH:MM:SS", or "HH:MM:SS+00" into minutes since midnight. */
export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Normalise any time string down to "HH:MM" (drops seconds / timezone). */
export function toHHMM(t: string | null | undefined): string {
  const mins = parseTimeToMinutes(t);
  if (mins == null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Add whole hours to an "HH:MM" time, wrapping past midnight. "22:00" + 2 → "00:00". */
export function addHoursToTime(time: string | null | undefined, hours: number): string {
  const mins = parseTimeToMinutes(time);
  if (mins == null) return "";
  const total = ((mins + hours * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** A [start, end) window in minutes, with overnight windows (end ≤ start) pushed past midnight. */
function toRange(start: string | null | undefined, end: string | null | undefined): { s: number; e: number } | null {
  const s = parseTimeToMinutes(start);
  if (s == null) return null;
  let e = parseTimeToMinutes(end);
  if (e == null) e = s; // no end → treat as a point in time
  if (e <= s) e += 24 * 60; // overnight (e.g. 22:00 → 00:00)
  return { s, e };
}

/** Half-open overlap test for two normalised ranges. */
export function rangesOverlap(a: { s: number; e: number }, b: { s: number; e: number }): boolean {
  return a.s < b.e && b.s < a.e;
}

export type ClashEventInput = {
  id: number;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type ClashEvent = { id: number; title: string; start: string; end: string };

/**
 * Return the events whose time window overlaps `target`. Events with no start time
 * are skipped (can't be placed). The caller is responsible for only passing events
 * on the relevant date that are active (and excluding the booking's own event).
 */
export function findEventClashes(
  target: { start: string | null | undefined; end: string | null | undefined },
  events: ClashEventInput[]
): ClashEvent[] {
  const t = toRange(target.start, target.end);
  if (!t) return [];
  const clashes: ClashEvent[] = [];
  for (const ev of events) {
    const r = toRange(ev.start_time, ev.end_time);
    if (!r) continue;
    if (rangesOverlap(t, r)) {
      clashes.push({
        id: ev.id,
        title: ev.title || "Untitled Event",
        start: toHHMM(ev.start_time),
        end: toHHMM(ev.end_time),
      });
    }
  }
  return clashes;
}
