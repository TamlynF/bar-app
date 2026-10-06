import { randomUUID } from "crypto";
import { squareClient, squareErrorDetail } from "@/lib/square";
import {
  buildEventOrder,
  buildPaymentNote,
  buildPrePopulatedData,
  buildTicketCheckoutOptions,
  formatTicketCheckoutTitle,
  splitName,
} from "@/lib/square-order";
import { webPaymentsConfig, type InPagePayment } from "@/lib/square-web-payments";
import { getContactEmail } from "@/lib/company-info";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export interface BookingCheckoutInput {
  bookingId: number;
  eventId: number;
  title: string;
  eventDate: string | null;
  amountPence: number;
  groupSize: number;
  fullName: string;
  email: string;
  buyerPhone?: string;
  successPath: string;
  hostedOnly?: boolean;
}

export type BookingCheckout =
  | { ok: true; orderId: string; payment: InPagePayment }
  | { ok: true; orderId: string | undefined; checkoutUrl: string }
  | { ok: false; error: unknown };

export async function startBookingCheckout(input: BookingCheckoutInput): Promise<BookingCheckout> {
  const order = buildEventOrder({
    locationId: process.env.SQUARE_LOCATION_ID!,
    bookingId: input.bookingId,
    eventId: input.eventId,
    title: input.title,
    eventDate: input.eventDate,
    amountPence: input.amountPence,
    groupSize: input.groupSize,
    fullName: input.fullName,
  });

  const config = input.hostedOnly ? null : webPaymentsConfig();

  try {
    if (config) {
      const { order: created } = await squareClient.orders.create({
        idempotencyKey: randomUUID(),
        order,
      });
      if (!created?.id) return { ok: false, error: new Error("Square returned no order id") };
      const { firstName, lastName } = splitName(input.fullName);
      return {
        ok: true,
        orderId: created.id,
        payment: {
          ...config,
          bookingId: input.bookingId,
          amountPence: input.amountPence * input.groupSize,
          label: formatTicketCheckoutTitle(input),
          successPath: input.successPath,
          buyer: {
            givenName: firstName,
            ...(lastName ? { familyName: lastName } : {}),
            email: input.email,
            ...(input.buyerPhone ? { phone: input.buyerPhone } : {}),
          },
        },
      };
    }

    const { paymentLink } = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      paymentNote: buildPaymentNote({
        bookingId: input.bookingId,
        title: input.title,
        groupSize: input.groupSize,
        fullName: input.fullName,
        eventDate: input.eventDate,
      }),
      order,
      checkoutOptions: buildTicketCheckoutOptions({
        redirectUrl: `${appUrl}${input.successPath}`,
        supportEmail: await getContactEmail(),
      }),
      prePopulatedData: buildPrePopulatedData({
        email: input.email,
        fullName: input.fullName,
        buyerPhone: input.buyerPhone,
      }),
    });
    if (!paymentLink?.url) return { ok: false, error: new Error("Square returned no payment link") };
    return { ok: true, orderId: paymentLink.orderId, checkoutUrl: paymentLink.url };
  } catch (err) {
    console.error("[startBookingCheckout] Square error:", squareErrorDetail(err));
    return { ok: false, error: err };
  }
}
