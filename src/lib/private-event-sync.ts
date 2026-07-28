export type PrivateStatus = "pending" | "confirmed" | "cancelled";

export type PrivateEventPlan =
  | { action: "none" }
  | { action: "insert" } // create a new event and link it to the request
  | { action: "update"; eventId: number } // sync the already-linked event in place
  | { action: "deactivate"; eventId: number }; // take the linked event off the schedule

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

  if (eventId) return { action: "deactivate", eventId };

  return { action: "none" };
}
