import { describe, it, expect } from "vitest";
import {
  poundsToPence,
  splitName,
  buildBuyerPhone,
  formatTicketLineName,
  buildEventOrder,
  buildPrePopulatedData,
  type EventOrderInput,
} from "@/lib/square-order";

describe("poundsToPence", () => {
  it("converts pounds to integer pence", () => {
    expect(poundsToPence(12.5)).toBe(1250);
    expect(poundsToPence(10)).toBe(1000);
    expect(poundsToPence(0)).toBe(0);
  });

  it("rounds to the nearest penny, absorbing float fuzz", () => {
    expect(poundsToPence(12.3)).toBe(1230);   // 12.3 * 100 = 1229.9999… in float
    expect(poundsToPence(0.1 + 0.2)).toBe(30); // 0.30000000000000004
    expect(poundsToPence(19.995)).toBe(2000);  // rounds up
  });

  it("treats null/undefined as zero", () => {
    expect(poundsToPence(null)).toBe(0);
    expect(poundsToPence(undefined)).toBe(0);
  });
});

describe("splitName", () => {
  it("returns undefined last name for a single word", () => {
    expect(splitName("Jane")).toEqual({ firstName: "Jane", lastName: undefined });
  });

  it("splits first token from the rest", () => {
    expect(splitName("Jane Doe")).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(splitName("Jane Van Doe")).toEqual({ firstName: "Jane", lastName: "Van Doe" });
  });

  it("collapses surrounding and repeated whitespace", () => {
    expect(splitName("  Jane   Doe  ")).toEqual({ firstName: "Jane", lastName: "Doe" });
  });
});

describe("buildBuyerPhone", () => {
  it("concatenates country code and local number", () => {
    expect(buildBuyerPhone("+44", "7123456789")).toBe("+447123456789");
  });

  it("returns undefined when no number is given", () => {
    expect(buildBuyerPhone("+44", null)).toBeUndefined();
    expect(buildBuyerPhone("+44", "")).toBeUndefined();
    expect(buildBuyerPhone(null, undefined)).toBeUndefined();
  });

  it("tolerates a missing country code", () => {
    expect(buildBuyerPhone(null, "7123456789")).toBe("7123456789");
  });
});

describe("formatTicketLineName", () => {
  it("pluralises tickets and omits ids", () => {
    expect(formatTicketLineName("Boxing Day Bash", 1)).toBe("Boxing Day Bash - 1 ticket");
    expect(formatTicketLineName("Boxing Day Bash", 3)).toBe("Boxing Day Bash - 3 tickets");
  });
});

const baseInput: EventOrderInput = {
  locationId: "LOC123",
  bookingId: 42,
  eventId: 7,
  title: "Boxing Day Bash",
  amountPence: 1500,
  groupSize: 3,
  fullName: "Jane Doe",
  email: "jane@example.com",
  buyerPhone: "+447123456789",
};

describe("buildEventOrder", () => {
  it("links the booking via referenceId and metadata, not the line name", () => {
    const order = buildEventOrder(baseInput);
    expect(order.referenceId).toBe("42");
    expect(order.metadata).toEqual({ booking_id: "42", event_id: "7" });
    expect(order.lineItems?.[0].name).toBe("Boxing Day Bash - 3 tickets");
    expect(order.lineItems?.[0].name).not.toContain("42");
  });

  it("prices per ticket with quantity = group size (Square multiplies)", () => {
    const order = buildEventOrder(baseInput);
    const line = order.lineItems![0];
    expect(line.quantity).toBe("3");
    expect(line.basePriceMoney?.amount).toBe(BigInt(1500));
    expect(line.basePriceMoney?.currency).toBe("GBP");
    expect(line.basePriceMoney?.amount).not.toBe(BigInt(4500));
  });

  it("sets a PICKUP fulfillment recipient to the real booker", () => {
    const order = buildEventOrder(baseInput);
    const recipient = order.fulfillments?.[0].pickupDetails?.recipient;
    expect(order.fulfillments?.[0].type).toBe("PICKUP");
    expect(recipient?.displayName).toBe("Jane Doe");
    expect(recipient?.emailAddress).toBe("jane@example.com");
    expect(recipient?.phoneNumber).toBe("+447123456789");
  });

  it("omits the recipient phone when the booker gave no number", () => {
    const order = buildEventOrder({ ...baseInput, buyerPhone: undefined });
    const recipient = order.fulfillments?.[0].pickupDetails?.recipient;
    expect(recipient).not.toHaveProperty("phoneNumber");
    expect(recipient?.displayName).toBe("Jane Doe");
  });

  it("defaults the currency to GBP but honours an override", () => {
    expect(buildEventOrder(baseInput).lineItems?.[0].basePriceMoney?.currency).toBe("GBP");
    expect(
      buildEventOrder({ ...baseInput, currency: "USD" }).lineItems?.[0].basePriceMoney?.currency
    ).toBe("USD");
  });
});

describe("buildPrePopulatedData", () => {
  it("prefills email, phone and split name", () => {
    const data = buildPrePopulatedData({
      email: "jane@example.com",
      fullName: "Jane Doe",
      buyerPhone: "+447123456789",
    });
    expect(data.buyerEmail).toBe("jane@example.com");
    expect(data.buyerPhoneNumber).toBe("+447123456789");
    expect(data.buyerAddress).toEqual({ firstName: "Jane", lastName: "Doe" });
  });

  it("omits the phone when absent and leaves a single-word last name undefined", () => {
    const data = buildPrePopulatedData({ email: "j@example.com", fullName: "Jane" });
    expect(data).not.toHaveProperty("buyerPhoneNumber");
    expect(data.buyerAddress).toEqual({ firstName: "Jane", lastName: undefined });
  });
});
