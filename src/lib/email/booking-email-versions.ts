export const BOOKING_EMAILS = [
  { slot: "confirmed", key: "booking.event.confirmed", label: "Booking confirmed" },
  { slot: "waitlisted", key: "booking.event.waitlisted", label: "Booking waitlisted" },
  { slot: "payment_pending", key: "booking.payment_pending", label: "Payment not finished" },
  { slot: "changed_by_customer", key: "booking.changed.by_customer", label: "Changed by the customer" },
  { slot: "changed_by_admin", key: "booking.changed.by_admin", label: "Changed by staff" },
  { slot: "cancelled_by_customer", key: "booking.cancelled.by_customer", label: "Cancelled by the customer" },
  { slot: "cancelled_by_admin", key: "booking.cancelled.by_admin", label: "Cancelled by staff" },
] as const;

export type BookingEmailSlot = (typeof BOOKING_EMAILS)[number]["slot"];
/* A version's email_templates id, or STANDARD_CHOICE to insist on the standard
   email even when a broader level picked a version. */
export type BookingEmailChoices = Partial<Record<BookingEmailSlot, number>>;
export const STANDARD_CHOICE = 0;
export type ChoiceSource = "event" | "subtype" | "type";

export interface EmailVersion {
  id: number;
  scenarioKey: string;
  name: string;
}

const SLOT_BY_KEY = new Map<string, BookingEmailSlot>(BOOKING_EMAILS.map((e) => [e.key, e.slot]));
const SLOTS = new Set<string>(BOOKING_EMAILS.map((e) => e.slot));

export function bookingEmailSlot(scenarioKey: string): BookingEmailSlot | null {
  return SLOT_BY_KEY.get(scenarioKey) ?? null;
}

export function isVersionable(scenarioKey: string): boolean {
  return SLOT_BY_KEY.has(scenarioKey);
}

export function sanitizeBookingEmailChoices(raw: unknown): BookingEmailChoices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const choices: BookingEmailChoices = {};
  for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = typeof value === "string" ? Number(value) : value;
    if (SLOTS.has(slot) && typeof id === "number" && Number.isInteger(id) && id >= STANDARD_CHOICE) {
      choices[slot as BookingEmailSlot] = id;
    }
  }
  return choices;
}

export function parseBookingEmails(raw: string | null | undefined): BookingEmailChoices | null {
  if (!raw) return null;
  try {
    return choicesOrNull(sanitizeBookingEmailChoices(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export function choicesOrNull(choices: BookingEmailChoices): BookingEmailChoices | null {
  return Object.keys(choices).length > 0 ? choices : null;
}

export interface ChoiceLevels {
  event?: unknown;
  subtype?: unknown;
  type?: unknown;
}

export function resolveBookingEmailChoice(
  slot: BookingEmailSlot,
  levels: ChoiceLevels
): { versionId: number; source: ChoiceSource } | null {
  for (const source of ["event", "subtype", "type"] as const) {
    const id = sanitizeBookingEmailChoices(levels[source])[slot];
    if (id !== undefined) return { versionId: id, source };
  }
  return null;
}

export function withoutVersion(raw: unknown, versionId: number): BookingEmailChoices | null {
  const choices = sanitizeBookingEmailChoices(raw);
  for (const slot of Object.keys(choices) as BookingEmailSlot[]) {
    if (choices[slot] === versionId) delete choices[slot];
  }
  return choicesOrNull(choices);
}

export function normalizeVersionName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 60);
}
