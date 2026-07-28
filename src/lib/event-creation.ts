export const EVENT_CREATION_METHODS = ["manual", "copy", "band_request", "private_hire_request"] as const;

export type EventCreationMethod = (typeof EVENT_CREATION_METHODS)[number];

export const EVENT_CREATION_METHOD_LABELS: Record<EventCreationMethod, string> = {
  manual: "Manual",
  copy: "Copy",
  band_request: "Band Request",
  private_hire_request: "Private Hire Request",
};

export function isEventCreationMethod(value: unknown): value is EventCreationMethod {
  return typeof value === "string" && (EVENT_CREATION_METHODS as readonly string[]).includes(value);
}

export function eventCreationMethodLabel(value: unknown): string {
  return isEventCreationMethod(value) ? EVENT_CREATION_METHOD_LABELS[value] : "Manual";
}

export function eventCreationSourceHref(method: unknown, sourceId: string | null | undefined): string | null {
  const id = sourceId?.trim();
  if (!id || !isEventCreationMethod(method)) return null;
  if (method === "copy") return `/event-setups/events?open=${id}`;
  if (method === "band_request") return `/event-bookings/music-bookings?open=${id}`;
  if (method === "private_hire_request") return `/event-bookings/private-bookings?open=${id}`;
  return null;
}

export function eventCreationSourceLabel(method: unknown, sourceId: string | null | undefined): string | null {
  const id = sourceId?.trim();
  if (!id) return null;
  return method === "copy" ? id : id.slice(0, 8).toUpperCase();
}
