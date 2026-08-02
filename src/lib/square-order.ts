import type { Square } from "square";

export function poundsToPence(pounds: number | null | undefined): number {
  return Math.round((pounds ?? 0) * 100);
}

export function splitName(fullName: string): { firstName: string; lastName: string | undefined } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined };
}

export function buildBuyerPhone(
  countryCode: string | null | undefined,
  phoneNo: string | null | undefined
): string | undefined {
  if (!phoneNo) return undefined;
  return `${countryCode ?? ""}${phoneNo}`.trim();
}

export function formatTicketLineName(title: string, groupSize: number): string {
  return `${title} - ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`;
}

export interface EventOrderInput {
  locationId: string;
  bookingId: number;
  eventId: number;
  title: string;
  amountPence: number;
  groupSize: number;
  fullName: string;
  email: string;
  buyerPhone?: string;
  currency?: Square.Currency;
}

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
