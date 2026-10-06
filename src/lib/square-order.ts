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

export const PAYMENT_NOTE_MAX = 72;
const NOTE_NAME_MAX = 20;
const NOTE_TITLE_MIN = 12;
const NOTE_SEPARATOR = " - ";

export function truncateText(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/* Square's transaction list and phone app cut this heading short, so the
   fixed-width parts (booking, tickets, name) lead and the event title is
   shortened to fit PAYMENT_NOTE_MAX. The date goes first when space runs out. */
export function buildPaymentNote(input: {
  bookingId: number;
  title: string;
  groupSize: number;
  fullName: string;
  eventDate?: string | null;
}): string {
  const lead = [
    `Booking #${input.bookingId}`,
    `${input.groupSize} ticket${input.groupSize !== 1 ? "s" : ""}`,
    truncateText(input.fullName, NOTE_NAME_MAX),
  ].filter(Boolean);
  const date = input.eventDate
    ? format(new Date(`${input.eventDate}T00:00:00`), "d MMM")
    : undefined;

  const titleRoom = (tail: string[]) =>
    PAYMENT_NOTE_MAX - [...lead, ...tail].join(NOTE_SEPARATOR).length - NOTE_SEPARATOR.length;

  const title = input.title.trim();
  const tail = date && titleRoom([date]) >= Math.min(NOTE_TITLE_MIN, title.length) ? [date] : [];
  const room = titleRoom(tail);
  const parts = room > 0 && title ? [...lead, truncateText(title, room), ...tail] : [...lead, ...tail];
  return parts.join(NOTE_SEPARATOR);
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

export function formatTicketCheckoutTitle(input: {
  title: string;
  groupSize: number;
  eventDate?: string | null;
}): string {
  const date = formatEventDateNote(input.eventDate);
  return [formatTicketLineName(input.title, input.groupSize), date].filter(Boolean).join(" - ");
}

/* No fulfillment: Square rejects a payment link that has both a fulfillment
   and prePopulatedData (CONFLICTING_PARAMETERS), and adds a DIGITAL one itself
   once the buyer pays. The booker is identified by ticketName instead.
   One line at the group total, so checkout reads "Quiz Night - 2 tickets"
   rather than an "Order summary (2 items)" list. */
export function buildEventOrder(input: EventOrderInput): Square.Order {
  return {
    locationId: input.locationId,
    referenceId: String(input.bookingId),
    ticketName: formatBookingTicketName(input.bookingId, input.fullName),
    metadata: { booking_id: String(input.bookingId), event_id: String(input.eventId) },
    lineItems: [{
      name: formatTicketCheckoutTitle(input),
      quantity: "1",
      basePriceMoney: {
        amount: BigInt(input.amountPence * input.groupSize),
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

export function buildTicketCheckoutOptions(input: {
  redirectUrl: string;
  supportEmail?: string | null;
}): Square.CheckoutOptions {
  return {
    ...buildCheckoutOptions(input),
    allowTipping: false,
    enableCoupon: false,
    enableLoyalty: false,
    askForShippingAddress: false,
    acceptedPaymentMethods: {
      applePay: true,
      googlePay: true,
      cashAppPay: false,
      afterpayClearpay: false,
    },
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
