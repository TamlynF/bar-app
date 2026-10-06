import { describe, it, expect } from "vitest";
import {
  PAYMENT_FALLBACK_MESSAGE,
  buildVerificationDetails,
  formatSquareAmount,
  paymentDeclineMessage,
  squareSdkUrl,
  webPaymentsConfig,
  type InPagePayment,
} from "@/lib/square-web-payments";

describe("webPaymentsConfig", () => {
  it("is off until an application id is set, so checkout falls back to the hosted page", () => {
    expect(webPaymentsConfig({ SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "sandbox" })).toBeNull();
    expect(webPaymentsConfig({ SQUARE_APPLICATION_ID: " ", SQUARE_LOCATION_ID: "L1" })).toBeNull();
  });

  it("needs a location id too", () => {
    expect(webPaymentsConfig({ SQUARE_APPLICATION_ID: "sandbox-sq0idb-abc" })).toBeNull();
  });

  it("returns sandbox config for a sandbox app id outside production", () => {
    expect(
      webPaymentsConfig({ SQUARE_APPLICATION_ID: "sandbox-sq0idb-abc", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "sandbox" })
    ).toEqual({ applicationId: "sandbox-sq0idb-abc", locationId: "L1", sandbox: true });
  });

  it("returns production config for a production app id in production", () => {
    expect(
      webPaymentsConfig({ SQUARE_APPLICATION_ID: "sq0idp-abc", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "production" })
    ).toEqual({ applicationId: "sq0idp-abc", locationId: "L1", sandbox: false });
  });

  it("refuses an app id from the other environment rather than show a form that can't charge", () => {
    expect(
      webPaymentsConfig({ SQUARE_APPLICATION_ID: "sq0idp-abc", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "sandbox" })
    ).toBeNull();
    expect(
      webPaymentsConfig({ SQUARE_APPLICATION_ID: "sandbox-sq0idb-abc", SQUARE_LOCATION_ID: "L1", SQUARE_ENVIRONMENT: "production" })
    ).toBeNull();
  });
});

describe("squareSdkUrl", () => {
  it("picks the sandbox or live script", () => {
    expect(squareSdkUrl(true)).toBe("https://sandbox.web.squarecdn.com/v1/square.js");
    expect(squareSdkUrl(false)).toBe("https://web.squarecdn.com/v1/square.js");
  });
});

describe("formatSquareAmount", () => {
  it("formats pence as a two-decimal pounds string", () => {
    expect(formatSquareAmount(2000)).toBe("20.00");
    expect(formatSquareAmount(1050)).toBe("10.50");
    expect(formatSquareAmount(5)).toBe("0.05");
  });
});

const payment: InPagePayment = {
  applicationId: "sandbox-sq0idb-abc",
  locationId: "L1",
  sandbox: true,
  bookingId: 42,
  amountPence: 2000,
  label: "Quiz Night - 2 tickets - Thu 9 Oct 2026",
  successPath: "/book/event/7/success?bookingId=42",
  buyer: { givenName: "Jane", familyName: "Doe", email: "jane@example.com", phone: "+447123456789" },
};

describe("buildVerificationDetails", () => {
  it("describes a customer-initiated GBP charge for the bank check", () => {
    expect(buildVerificationDetails(payment)).toEqual({
      amount: "20.00",
      currencyCode: "GBP",
      intent: "CHARGE",
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: {
        givenName: "Jane",
        familyName: "Doe",
        email: "jane@example.com",
        phone: "+447123456789",
        countryCode: "GB",
      },
    });
  });

  it("leaves out a missing surname and phone", () => {
    const details = buildVerificationDetails({ ...payment, buyer: { givenName: "Jane", email: "jane@example.com" } });
    expect(details.billingContact).not.toHaveProperty("familyName");
    expect(details.billingContact).not.toHaveProperty("phone");
  });
});

describe("paymentDeclineMessage", () => {
  it("explains common declines in plain words", () => {
    expect(paymentDeclineMessage("INSUFFICIENT_FUNDS")).toMatch(/insufficient funds/);
    expect(paymentDeclineMessage("CVV_FAILURE")).toMatch(/security code/);
    expect(paymentDeclineMessage("ADDRESS_VERIFICATION_FAILURE")).toMatch(/postcode/);
  });

  it("falls back to a safe message for anything else", () => {
    expect(paymentDeclineMessage("SOMETHING_NEW")).toBe(PAYMENT_FALLBACK_MESSAGE);
    expect(paymentDeclineMessage(undefined)).toBe(PAYMENT_FALLBACK_MESSAGE);
  });
});
