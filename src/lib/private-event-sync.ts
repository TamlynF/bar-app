// Decides how a private-hire request's status change affects its linked `events`
// row. Kept pure (no Supabase) so the branching can be unit-tested;
// `updatePrivateHireStatus` executes whatever plan this returns. Mirrors
// `planBandEventSync` — private hire only has confirmed / rejected outcomes.

export type PrivateStatus = "confirmed" | "rejected";

export type PrivateEventPlan =
  | { action: "none" }
  | { action: "insert" } // create a new event and link it to the request
  | { action: "update"; eventId: number } // sync the already-linked event in place
  | { action: "deactivate"; eventId: number }; // take the linked event off the schedule

/**
 * - Confirmed + a selected date → create the event, or update the existing linked
 *   one (so re-confirming never creates a duplicate). is_active = true.
 * - Rejected with an existing linked event → deactivate it (is_active = false).
 * - Confirmed without a date, or rejected with no linked event → no event change.
 */
export function planPrivateEventSync(params: {
  status: PrivateStatus;
  selectedDate: string | null;
  eventId: number | null;
}): PrivateEventPlan {
  const { status, selectedDate, eventId } = params;

  if (status === "confirmed") {
    if (!selectedDate) return { action: "none" }; // can't place an event without a date
    return eventId ? { action: "update", eventId } : { action: "insert" };
  }

  // Rejected: take the linked event off the schedule if there is one.
  if (eventId) return { action: "deactivate", eventId };

  return { action: "none" };
}
