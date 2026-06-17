// Decides how a band/artist booking's status change should affect its linked
// `events` row. Kept pure (no Supabase) so the branching can be unit-tested;
// `updateBandStatus` executes whatever plan this returns.

export type BandStatus = "pending" | "confirmed" | "cancelled";

export type BandEventPlan =
  | { action: "none" }
  | { action: "insert" } // create a new event and link it to the booking
  | { action: "update"; eventId: number } // sync the already-linked event in place
  | { action: "deactivate"; eventId: number }; // take the linked event off the schedule

/**
 * Mirrors the rule "if the new status is confirmed the linked event is active,
 * otherwise it's inactive":
 * - Confirmed + a selected date → create the event, or update the existing linked
 *   one (so re-confirming after a cancel never creates a duplicate). is_active = true.
 * - Any other status (pending / cancelled) with an existing linked
 *   event → deactivate it (is_active = false, off the schedule).
 * - Confirmed without a date, or anything with no linked event → no event change.
 */
export function planBandEventSync(params: {
  status: BandStatus;
  selectedDate: string | null;
  eventId: number | null;
}): BandEventPlan {
  const { status, selectedDate, eventId } = params;

  if (status === "confirmed") {
    if (!selectedDate) return { action: "none" }; // can't place an event without a date
    return eventId ? { action: "update", eventId } : { action: "insert" };
  }

  // Not confirmed: take the linked event off the schedule if there is one.
  if (eventId) return { action: "deactivate", eventId };

  return { action: "none" };
}
