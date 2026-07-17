// Derives the "where is this booking in its life" badge for a band request:
// finished, or coming up. Pure (a `now` is passed in) so the rule can be unit-
// tested and so the caller controls the clock — the card reads it on the client,
// where "now" is the venue's wall clock rather than the build server's UTC.

import { addMonths, startOfDay } from "date-fns";
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

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;

/** How far ahead a booking still reads as "upcoming". */
const UPCOMING_HORIZON_MONTHS = 1;

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
 * `completed` once the slot has finished, `upcoming` while it's still ahead and
 * within the horizon, otherwise null.
 *
 * Null covers the cases with nothing useful to say: any status but booked, no
 * linked event, a booking further out than the horizon, and the gap between
 * start and end — a set that's mid-performance, where neither label is true.
 * `completed` deliberately ignores `is_active`: a gig that happened, happened,
 * whether or not its event was later taken off the schedule.
 */
export function bandLifecycleStage(input: BandLifecycleInput, now: Date): BandLifecycleStage | null {
  if ((input.status ?? "").trim().toLowerCase() !== "booked") return null;
  if (input.eventId == null) return null;
  if (!input.date) return null;

  const slot = slotInstants(input.date, input.startTime, input.endTime);
  if (!slot) return null;

  if (slot.end.getTime() < now.getTime()) return "completed";

  // Everything below is a claim about a night that's still to come, so it only
  // holds while the event is actually on the schedule.
  if (input.eventIsActive !== true) return null;
  if (slot.start.getTime() <= now.getTime()) return null;

  const horizon = addMonths(startOfDay(now), UPCOMING_HORIZON_MONTHS);
  if (slot.day.getTime() > horizon.getTime()) return null;

  return "upcoming";
}
