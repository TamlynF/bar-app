// Decides how a band/artist booking's status change should affect its linked
// `events` row. Kept pure (no Supabase) so the branching can be unit-tested;
// `updateBandStatus` executes whatever plan this returns.

export type BandStatus = "new" | "reviewing" | "offered" | "booked" | "declined";

export type BandEventPlan =
  | { action: "none" }
  | { action: "insert" } // create a new event and link it to the booking
  | { action: "update"; eventId: number } // sync the already-linked event in place
  | { action: "deactivate"; eventId: number }; // take the linked event off the schedule

/**
 * Mirrors the rule "only a booked application has an active event":
 * - Booked + a selected date → create the event, or update the existing linked
 *   one (so re-booking after a decline never creates a duplicate). is_active = true.
 * - Any other status (new / reviewing / offered / declined) with an existing
 *   linked event → deactivate it (is_active = false, off the schedule).
 * - Booked without a date, or anything with no linked event → no event change.
 */
export function planBandEventSync(params: {
  status: BandStatus;
  selectedDate: string | null;
  eventId: number | null;
}): BandEventPlan {
  const { status, selectedDate, eventId } = params;

  if (status === "booked") {
    if (!selectedDate) return { action: "none" }; // can't place an event without a date
    return eventId ? { action: "update", eventId } : { action: "insert" };
  }

  // Not booked: take the linked event off the schedule if there is one.
  if (eventId) return { action: "deactivate", eventId };

  return { action: "none" };
}
