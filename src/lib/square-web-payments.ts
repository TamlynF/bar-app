export interface WebPaymentsConfig {
  applicationId: string;
  locationId: string;
  sandbox: boolean;
}

export interface InPagePayment extends WebPaymentsConfig {
  bookingId: number;
  amountPence: number;
  label: string;
  successPath: string;
  buyer: {
    givenName: string;
    familyName?: string;
    email: string;
    phone?: string;
  };
}

export interface VerificationDetails {
  amount: string;
  currencyCode: "GBP";
  intent: "CHARGE";
  customerInitiated: true;
  sellerKeyedIn: false;
  billingContact: {
    givenName: string;
    familyName?: string;
    email: string;
    phone?: string;
    countryCode: "GB";
  };
}

type Env = Record<string, string | undefined>;

export function webPaymentsConfig(env: Env = process.env): WebPaymentsConfig | null {
  const applicationId = env.SQUARE_APPLICATION_ID?.trim();
  const locationId = env.SQUARE_LOCATION_ID?.trim();
  if (!applicationId || !locationId) return null;
  const sandbox = env.SQUARE_ENVIRONMENT !== "production";
  if (sandbox !== applicationId.startsWith("sandbox-")) return null;
  return { applicationId, locationId, sandbox };
}

export function squareSdkUrl(sandbox: boolean): string {
  return sandbox
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
}

export function formatSquareAmount(pence: number): string {
  return (pence / 100).toFixed(2);
}

export function buildVerificationDetails(payment: InPagePayment): VerificationDetails {
  const { givenName, familyName, email, phone } = payment.buyer;
  return {
    amount: formatSquareAmount(payment.amountPence),
    currencyCode: "GBP",
    intent: "CHARGE",
    customerInitiated: true,
    sellerKeyedIn: false,
    billingContact: {
      givenName,
      ...(familyName ? { familyName } : {}),
      email,
      ...(phone ? { phone } : {}),
      countryCode: "GB",
    },
  };
}

const DECLINE_MESSAGES: Record<string, string> = {
  CARD_DECLINED: "Your card was declined. Please try another card.",
  GENERIC_DECLINE: "Your card was declined. Please try another card.",
  INSUFFICIENT_FUNDS: "Your card was declined for insufficient funds. Please try another card.",
  CVV_FAILURE: "The security code didn't match. Please check it and try again.",
  ADDRESS_VERIFICATION_FAILURE: "The postcode didn't match your card. Please check it and try again.",
  INVALID_POSTAL_CODE: "The postcode didn't match your card. Please check it and try again.",
  INVALID_EXPIRATION: "The expiry date isn't valid. Please check it and try again.",
  EXPIRATION_FAILURE: "The expiry date isn't valid. Please check it and try again.",
  INVALID_CARD: "That card number isn't valid. Please check it and try again.",
  INVALID_ACCOUNT: "That card number isn't valid. Please check it and try again.",
  CARD_NOT_SUPPORTED: "That card isn't supported. Please try another card.",
  CARD_EXPIRED: "That card has expired. Please try another card.",
  VERIFY_CVV_FAILURE: "The security code didn't match. Please check it and try again.",
  VERIFY_AVS_FAILURE: "The postcode didn't match your card. Please check it and try again.",
  CARD_DECLINED_VERIFICATION_REQUIRED: "Your bank needs to verify this payment. Please try again.",
  TRANSACTION_LIMIT: "This payment is over your card's limit. Please try another card.",
  ALLOWABLE_PIN_TRIES_EXCEEDED: "Your card is locked by your bank. Please try another card.",
};

export const PAYMENT_FALLBACK_MESSAGE =
  "We couldn't take that payment. Nothing has been charged - please try again.";

export function paymentDeclineMessage(code: string | null | undefined): string {
  return (code && DECLINE_MESSAGES[code]) || PAYMENT_FALLBACK_MESSAGE;
}
