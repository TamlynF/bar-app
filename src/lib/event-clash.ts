export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function toHHMM(t: string | null | undefined): string {
  const mins = parseTimeToMinutes(t);
  if (mins == null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function addHoursToTime(time: string | null | undefined, hours: number): string {
  const mins = parseTimeToMinutes(time);
  if (mins == null) return "";
  const total = ((mins + hours * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function toRange(start: string | null | undefined, end: string | null | undefined): { s: number; e: number } | null {
  const s = parseTimeToMinutes(start);
  if (s == null) return null;
  let e = parseTimeToMinutes(end);
  if (e == null) e = s; // no end → treat as a point in time
  if (e <= s) e += 24 * 60; // overnight (e.g. 22:00 → 00:00)
  return { s, e };
}

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
