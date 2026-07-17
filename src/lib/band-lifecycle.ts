// Derives the "where is this booking in its life" badge for band requests:
// finished, or the one night coming up next. Pure (a `now` is passed in) so the
// rule can be unit-tested and so the caller controls the clock — the board reads
// it on the client, where "now" is the venue's wall clock rather than the build
// server's UTC.

import { parseTimeToMinutes } from "./event-clash";

export type BandLifecycleStage = "completed" | "upcoming";

export interface BandLifecycleInput {
  /** Request status — only `booked` ever earns a badge. */
  status: string | null | undefined;
  /** `band_booking_requests.event_id` — null means no event was ever placed. */
  eventId: number | null | undefined;
  /** The linked event's `is_active`. Only gates "upcoming". */
  eventIsActive: boolean | undefined;
  /** The linked event's `date`, as the DB's `YYYY-MM-DD`. */
  date: string | null | undefined;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
}

export interface BandLifecycleRequest extends BandLifecycleInput {
  /** `band_booking_requests.id` — the key the returned map is stamped with. */
  id: string;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;

/**
 * The slot as real instants rather than bare times, so an overnight window is
 * placed on the right side of midnight. Follows the same convention as
 * `toRange` in event-clash: an end at or before the start belongs to the next
 * day, so 22:00–00:00 on the 22nd ends at 00:00 on the 23rd — not at the start
 * of the 22nd, which would read as finished all day before it even began.
 *
 * Missing times degrade to the widest honest reading: no start is midnight, and
 * no times at all spans the whole day.
 */
function slotInstants(date: string, startTime: string | null | undefined, endTime: string | null | undefined) {
  // `T00:00:00` keeps a date-only string on its own day instead of shifting it
  // by the timezone offset.
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  const from = startMinutes ?? 0;
  // No end at all: a start alone is a point in time; neither is the whole day.
  let to = endMinutes ?? startMinutes ?? MINUTES_PER_DAY;
  if (endMinutes != null && to <= from) to += MINUTES_PER_DAY;

  return {
    day,
    start: new Date(day.getTime() + from * MS_PER_MINUTE),
    end: new Date(day.getTime() + to * MS_PER_MINUTE),
  };
}

/**
 * The stage for every request that earns one, keyed by request id.
 *
 * `completed` is a fact about one request on its own: its slot has finished. It
 * deliberately ignores `is_active` — a gig that happened, happened, whether or
 * not its event was later taken off the schedule.
 *
 * `upcoming` is a claim about the board as a whole, which is why this reads the
 * whole list rather than one request at a time: only the *next* night on the
 * schedule is upcoming, so at most one id ever carries it. To be in the running
 * a request must be booked, have a linked event that's still active, and start
 * in the future; the earliest such start wins, a tie going to the first in the
 * list. There's no horizon — the next night is the next night, however far out.
 *
 * A request with nothing useful to say is simply absent from the map: any status
 * but booked, no linked event, no date, a future night that isn't the next one,
 * and the gap between start and end — where a gig is mid-performance and neither
 * label is true.
 */
export function bandLifecycleStages(
  requests: BandLifecycleRequest[],
  now: Date
): Map<string, BandLifecycleStage> {
  const stages = new Map<string, BandLifecycleStage>();
  /** The earliest future night seen so far — the `upcoming` incumbent. */
  let nextUp: { id: string; start: number } | null = null;

  for (const request of requests) {
    if ((request.status ?? "").trim().toLowerCase() !== "booked") continue;
    if (request.eventId == null) continue;
    if (!request.date) continue;

    const slot = slotInstants(request.date, request.startTime, request.endTime);
    if (!slot) continue;

    if (slot.end.getTime() < now.getTime()) {
      stages.set(request.id, "completed");
      continue;
    }

    // Everything below is a claim about a night that's still to come, so it only
    // holds while the event is actually on the schedule.
    if (request.eventIsActive !== true) continue;

    const start = slot.start.getTime();
    // Already underway — neither finished nor ahead, and it must not take the
    // upcoming slot from the night that genuinely is next.
    if (start <= now.getTime()) continue;

    if (!nextUp || start < nextUp.start) nextUp = { id: request.id, start };
  }

  if (nextUp) stages.set(nextUp.id, "upcoming");
  return stages;
}
