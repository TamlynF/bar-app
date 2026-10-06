import { describe, it, expect } from "vitest";
import {
  poundsToPence,
  splitName,
  buildBuyerPhone,
  formatTicketLineName,
  buildEventOrder,
  buildCheckoutOptions,
  buildPrePopulatedData,
  buildPaymentNote,
  buildTicketCheckoutOptions,
  truncateText,
  PAYMENT_NOTE_MAX,
  formatBookingTicketName,
  type EventOrderInput,
} from "@/lib/square-order";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/email";

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

  it("assumes the UK when no country code is given", () => {
    expect(buildBuyerPhone(null, "7123456789")).toBe("+447123456789");
  });

  it("drops the trunk zero that Square rejects", () => {
    expect(buildBuyerPhone("+44", "07123 456789")).toBe("+447123456789");
    expect(buildBuyerPhone("+353", "087 123 4567")).toBe("+353871234567");
  });

  it("keeps a number typed in international form whatever the country code", () => {
    expect(buildBuyerPhone("+44", "+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("leaves out a number too short to be real", () => {
    expect(buildBuyerPhone("+44", "123")).toBeUndefined();
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
  eventDate: "2026-12-26",
  fullName: "Jane Doe",
};

describe("buildEventOrder", () => {
  it("links the booking via referenceId and metadata, not the line name", () => {
    const order = buildEventOrder(baseInput);
    expect(order.referenceId).toBe("42");
    expect(order.metadata).toEqual({ booking_id: "42", event_id: "7" });
    expect(order.lineItems?.[0].name).toBe("Boxing Day Bash - 3 tickets - Sat 26 Dec 2026");
    expect(order.lineItems?.[0].name).not.toContain("42");
  });

  it("charges the group as one line at the total, so checkout shows a single item", () => {
    const order = buildEventOrder(baseInput);
    expect(order.lineItems).toHaveLength(1);
    const line = order.lineItems![0];
    expect(line.quantity).toBe("1");
    expect(line.basePriceMoney?.amount).toBe(BigInt(4500));
    expect(line.basePriceMoney?.currency).toBe("GBP");
  });

  it("sends no fulfillment, which Square rejects alongside prePopulatedData", () => {
    expect(buildEventOrder(baseInput)).not.toHaveProperty("fulfillments");
  });

  it("names the ticket after the booking and booker so staff can find it in Square", () => {
    expect(buildEventOrder(baseInput).ticketName).toBe("Booking #42 - Jane Doe");
  });

  it("leaves the date out of the line name when unknown", () => {
    expect(buildEventOrder({ ...baseInput, eventDate: null }).lineItems?.[0].name).toBe("Boxing Day Bash - 3 tickets");
  });

  it("defaults the currency to GBP but honours an override", () => {
    expect(buildEventOrder(baseInput).lineItems?.[0].basePriceMoney?.currency).toBe("GBP");
    expect(
      buildEventOrder({ ...baseInput, currency: "USD" }).lineItems?.[0].basePriceMoney?.currency
    ).toBe("USD");
  });
});

describe("formatBookingTicketName", () => {
  it("trims the name", () => {
    expect(formatBookingTicketName(7, "  Sam Lee ")).toBe("Booking #7 - Sam Lee");
  });
});

describe("buildTicketCheckoutOptions", () => {
  it("strips coupon, loyalty, tipping and shipping and puts wallets on", () => {
    const options = buildTicketCheckoutOptions({ redirectUrl: "https://example.com/r", supportEmail: "hi@bar.co.uk" });
    expect(options).toMatchObject({
      redirectUrl: "https://example.com/r",
      merchantSupportEmail: "hi@bar.co.uk",
      allowTipping: false,
      enableCoupon: false,
      enableLoyalty: false,
      askForShippingAddress: false,
      acceptedPaymentMethods: { applePay: true, googlePay: true, cashAppPay: false, afterpayClearpay: false },
    });
  });
});

describe("buildPaymentNote", () => {
  const note = { bookingId: 128, title: "The 1975 Night", groupSize: 2, fullName: "Jane Doe", eventDate: "2026-11-06" };

  it("leads with booking, tickets and name, then event and date", () => {
    expect(buildPaymentNote(note)).toBe("Booking #128 - 2 tickets - Jane Doe - The 1975 Night - 6 Nov");
  });

  it("says ticket for one", () => {
    expect(buildPaymentNote({ ...note, groupSize: 1 })).toContain("1 ticket - ");
  });

  it("drops the date when there isn't one", () => {
    expect(buildPaymentNote({ ...note, eventDate: null })).toBe("Booking #128 - 2 tickets - Jane Doe - The 1975 Night");
  });

  it("never exceeds the cap, shortening the event title and keeping booking, tickets and name whole", () => {
    const long = buildPaymentNote({
      bookingId: 99999,
      title: "An Evening Of Extremely Long Event Titles That Go On And On Forever",
      groupSize: 12,
      fullName: "Bartholomew Fitzgerald",
      eventDate: "2026-12-26",
    });
    expect(long.length).toBeLessThanOrEqual(PAYMENT_NOTE_MAX);
    expect(long.startsWith("Booking #99999 - 12 tickets - Bartholomew Fitzger… - ")).toBe(true);
    expect(long).toContain("An Evening");
    expect(long).toMatch(/…/);
  });

  it("keeps every note well inside Square's 500-character limit", () => {
    const huge = buildPaymentNote({ ...note, title: "x".repeat(600), fullName: "y".repeat(600) });
    expect(huge.length).toBeLessThanOrEqual(PAYMENT_NOTE_MAX);
  });
});

describe("truncateText", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(truncateText("  The   1975  Night ", 20)).toBe("The 1975 Night");
  });

  it("cuts long text to the limit with an ellipsis", () => {
    const cut = truncateText("Bartholomew Fitzgerald", 12);
    expect(cut).toBe("Bartholomew…");
    expect(cut.length).toBe(12);
  });
});

describe("buildCheckoutOptions", () => {
  it("uses the company email when one is set", () => {
    const options = buildCheckoutOptions({
      redirectUrl: "https://example.com/book/event/7/success?bookingId=42",
      supportEmail: "hello@donfenticas.co.uk",
    });
    expect(options.redirectUrl).toBe("https://example.com/book/event/7/success?bookingId=42");
    expect(options.merchantSupportEmail).toBe("hello@donfenticas.co.uk");
  });

  it("falls back to the default when the company email is missing or blank", () => {
    const redirectUrl = "https://example.com/book/event/7/success?bookingId=42";
    expect(buildCheckoutOptions({ redirectUrl }).merchantSupportEmail).toBe(
      DEFAULT_CONTACT_EMAIL
    );
    expect(buildCheckoutOptions({ redirectUrl, supportEmail: null }).merchantSupportEmail).toBe(
      DEFAULT_CONTACT_EMAIL
    );
    expect(buildCheckoutOptions({ redirectUrl, supportEmail: "   " }).merchantSupportEmail).toBe(
      DEFAULT_CONTACT_EMAIL
    );
  });

  it("trims a padded company email", () => {
    const options = buildCheckoutOptions({
      redirectUrl: "https://example.com/x",
      supportEmail: "  hello@donfenticas.co.uk  ",
    });
    expect(options.merchantSupportEmail).toBe("hello@donfenticas.co.uk");
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
