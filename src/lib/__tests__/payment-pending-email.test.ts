import { describe, it, expect } from "vitest";
import {
  buildPaymentPendingEmail,
  paymentPendingMergeValues,
} from "@/lib/payment-pending-email";
import { findScenario } from "@/lib/email/scenarios";
import { renderSlots } from "@/lib/email/render";

const base = {
  name: "Jane Doe",
  eventTitle: "Boxing Day Bash",
  eventDate: "2026-12-26",
  groupSize: 3,
  amountDue: 45,
  payUrl: "https://example.test/book/event/7/success?bookingId=42",
};

/* Built from the shipped template rather than from hand-written slots, so this
   suite also guards the default copy against an accidental edit. */
const build = (over: Partial<typeof base> = {}) => {
  const p = { ...base, ...over };
  const scenario = findScenario("booking.payment_pending")!;
  const { slots } = renderSlots(scenario.defaults, paymentPendingMergeValues(p));
  return buildPaymentPendingEmail({
    slots,
    eventDate: p.eventDate,
    groupSize: p.groupSize,
    amountDue: p.amountDue,
    payUrl: p.payUrl,
  });
};

describe("buildPaymentPendingEmail", () => {
  it("does not read as a confirmation", () => {
    const { subject, html } = build();

    expect(subject).toBe("Finish your booking: Boxing Day Bash @ Don Fenticas");
    expect(subject).not.toMatch(/confirmed/i);
    expect(html).not.toMatch(/booking confirmed/i);
    expect(html).toMatch(/haven't received your payment/i);
  });

  it("links to the page that can resume checkout", () => {
    const { html } = build();

    expect(html).toContain('href="https://example.test/book/event/7/success?bookingId=42"');
    expect(html).toContain("Complete Payment");
  });

  it("shows the amount owed and the date without a timezone shift", () => {
    const { html } = build();

    expect(html).toContain("Amount Due");
    expect(html).toContain("£45.00");
    expect(html).toContain("Saturday 26 December 2026");
  });

  it("uses singular wording for a party of one", () => {
    expect(build({ groupSize: 1 }).html).toContain("1 Person");
    expect(build({ groupSize: 4 }).html).toContain("4 People");
  });

  it("still warns that unpaid bookings are released", () => {
    expect(build().html).toMatch(/released automatically/i);
  });
});
