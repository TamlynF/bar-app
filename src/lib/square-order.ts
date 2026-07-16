import type { Square } from "square";

/**
 * Pure builders for the Square checkout payload used by the paid event/group
 * booking flow (`createEventBooking`). Kept free of the Square client, Supabase,
 * and `randomUUID` so the payload shape can be unit-tested in isolation. The
 * calling Server Action supplies the impure bits (idempotency key, redirect URL).
 */

/** Convert a pound amount to integer pence, rounding to the nearest penny. */
export function poundsToPence(pounds: number | null | undefined): number {
  return Math.round((pounds ?? 0) * 100);
}

/**
 * Split a full name into first/last for Square's buyer address. The first token
 * is the first name; everything after it is the last name (undefined when the
 * name is a single word), so "Jane Van Doe" → { firstName: "Jane", lastName: "Van Doe" }.
 */
export function splitName(fullName: string): { firstName: string; lastName: string | undefined } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined };
}

/**
 * Join a country code and local number into a single dialling string, or
 * undefined when no number was supplied (Square rejects empty phone fields).
 */
export function buildBuyerPhone(
  countryCode: string | null | undefined,
  phoneNo: string | null | undefined
): string | undefined {
  if (!phoneNo) return undefined;
  return `${countryCode ?? ""}${phoneNo}`.trim();
}

/** Customer-facing line-item name — no ids, correct ticket pluralisation. */
export function formatTicketLineName(title: string, groupSize: number): string {
  return `${title} — ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`;
}

export interface EventOrderInput {
  locationId: string;
  bookingId: number;
  eventId: number;
  title: string;
  /** Per-ticket price in pence; Square multiplies it by `quantity`. */
  amountPence: number;
  groupSize: number;
  fullName: string;
  email: string;
  /** Combined dialling string, or undefined when the booker gave no number. */
  buyerPhone?: string;
  currency?: Square.Currency;
}

/**
 * Build the Square `Order`: a single per-ticket line item (quantity = group
 * size), the booking id linked via `referenceId` + `metadata` (not the
 * customer-facing name), and a PICKUP fulfillment whose recipient is the real
 * booker so the dashboard shows them instead of Square's sandbox default buyer.
 */
export function buildEventOrder(input: EventOrderInput): Square.Order {
  const recipient: Square.FulfillmentRecipient = {
    displayName: input.fullName,
    emailAddress: input.email,
    ...(input.buyerPhone ? { phoneNumber: input.buyerPhone } : {}),
  };

  return {
    locationId: input.locationId,
    referenceId: String(input.bookingId),
    metadata: { booking_id: String(input.bookingId), event_id: String(input.eventId) },
    lineItems: [{
      name: formatTicketLineName(input.title, input.groupSize),
      quantity: String(input.groupSize),
      basePriceMoney: {
        amount: BigInt(input.amountPence),
        currency: input.currency ?? "GBP",
      },
    }],
    fulfillments: [{
      type: "PICKUP",
      state: "PROPOSED",
      pickupDetails: {
        scheduleType: "ASAP",
        recipient,
      },
    }],
  };
}

/** Pre-fill the checkout page with the booker's contact details. */
export function buildPrePopulatedData(input: {
  email: string;
  fullName: string;
  buyerPhone?: string;
}): Square.PrePopulatedData {
  const { firstName, lastName } = splitName(input.fullName);
  return {
    buyerEmail: input.email,
    ...(input.buyerPhone ? { buyerPhoneNumber: input.buyerPhone } : {}),
    buyerAddress: { firstName, lastName },
  };
}
