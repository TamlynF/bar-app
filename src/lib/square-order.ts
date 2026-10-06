import type { Square } from "square";
import { format } from "date-fns";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/email";
import { toE164 } from "@/lib/phone";

export function poundsToPence(pounds: number | null | undefined): number {
  return Math.round((pounds ?? 0) * 100);
}

export function splitName(fullName: string): { firstName: string; lastName: string | undefined } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined };
}

/* Square only accepts international numbers, so "07700 900123" with +44
   becomes "+447700900123" (the trunk 0 dropped). A number that still isn't
   a full one is left out rather than failing the checkout. */
export function buildBuyerPhone(
  countryCode: string | null | undefined,
  phoneNo: string | null | undefined
): string | undefined {
  if (!phoneNo?.trim()) return undefined;
  return toE164(phoneNo, countryCode?.trim() || undefined);
}

export function formatTicketLineName(title: string, groupSize: number): string {
  return `${title} - ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`;
}

export function formatBookingTicketName(bookingId: number, fullName: string): string {
  return `Booking #${bookingId} - ${fullName.trim()}`;
}

export function formatEventDateNote(eventDate: string | null | undefined): string | undefined {
  if (!eventDate) return undefined;
  return format(new Date(`${eventDate}T00:00:00`), "EEE d MMM yyyy");
}

export function buildPaymentNote(input: {
  bookingId: number;
  title: string;
  eventDate?: string | null;
}): string {
  const date = formatEventDateNote(input.eventDate);
  return [`Booking #${input.bookingId}`, input.title, date].filter(Boolean).join(" - ");
}

export interface EventOrderInput {
  locationId: string;
  bookingId: number;
  eventId: number;
  title: string;
  eventDate?: string | null;
  amountPence: number;
  groupSize: number;
  fullName: string;
  currency?: Square.Currency;
}

/* No fulfillment: Square rejects a payment link that has both a fulfillment
   and prePopulatedData (CONFLICTING_PARAMETERS), and adds a DIGITAL one itself
   once the buyer pays. The booker is identified by ticketName instead. */
export function buildEventOrder(input: EventOrderInput): Square.Order {
  const dateNote = formatEventDateNote(input.eventDate);
  return {
    locationId: input.locationId,
    referenceId: String(input.bookingId),
    ticketName: formatBookingTicketName(input.bookingId, input.fullName),
    metadata: { booking_id: String(input.bookingId), event_id: String(input.eventId) },
    lineItems: [{
      name: formatTicketLineName(input.title, input.groupSize),
      quantity: String(input.groupSize),
      ...(dateNote ? { note: dateNote } : {}),
      basePriceMoney: {
        amount: BigInt(input.amountPence),
        currency: input.currency ?? "GBP",
      },
    }],
  };
}

export function buildCheckoutOptions(input: {
  redirectUrl: string;
  supportEmail?: string | null;
}): Square.CheckoutOptions {
  return {
    redirectUrl: input.redirectUrl,
    merchantSupportEmail: input.supportEmail?.trim() || DEFAULT_CONTACT_EMAIL,
  };
}

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
