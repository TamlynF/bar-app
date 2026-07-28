import { describe, it, expect } from "vitest";
import { buildPaymentPendingEmail } from "@/lib/payment-pending-email";

const base = {
  name: "Jane Doe",
  eventTitle: "Boxing Day Bash",
  eventDate: "2026-12-26",
  groupSize: 3,
  amountDue: 45,
  payUrl: "https://example.test/book/event/7/success?bookingId=42",
};

describe("buildPaymentPendingEmail", () => {
  it("does not read as a confirmation", () => {
    const { subject, html } = buildPaymentPendingEmail(base);

    expect(subject).toBe("Finish your booking: Boxing Day Bash @ Don Fenticas");
    expect(subject).not.toMatch(/confirmed/i);
    expect(html).not.toMatch(/booking confirmed/i);
    expect(html).toMatch(/haven't received your payment/i);
  });

  it("links to the page that can resume checkout", () => {
    const { html } = buildPaymentPendingEmail(base);

    expect(html).toContain('href="https://example.test/book/event/7/success?bookingId=42"');
    expect(html).toContain("Complete Payment");
  });

  it("shows the amount owed and the date without a timezone shift", () => {
    const { html } = buildPaymentPendingEmail(base);

    expect(html).toContain("Amount Due");
    expect(html).toContain("£45.00");
    expect(html).toContain("Saturday 26 December 2026");
  });

  it("uses singular wording for a party of one", () => {
    expect(buildPaymentPendingEmail({ ...base, groupSize: 1 }).html).toContain("1 Person");
    expect(buildPaymentPendingEmail({ ...base, groupSize: 4 }).html).toContain("4 People");
  });
});
