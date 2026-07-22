export type BandStatus = "new" | "reviewing" | "offered" | "booked" | "declined";

export type BandEventPlan =
  | { action: "none" }
  | { action: "insert" } // create a new event and link it to the booking
  | { action: "update"; eventId: number } // sync the already-linked event in place
  | { action: "deactivate"; eventId: number }; // take the linked event off the schedule

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

  if (eventId) return { action: "deactivate", eventId };

  return { action: "none" };
}
