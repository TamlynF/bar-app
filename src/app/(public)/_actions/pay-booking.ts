"use server";

import { randomUUID } from "crypto";
import { SquareError } from "square";
import { createClient } from "@/lib/supabase/server";
import { squareClient, squareErrorDetail } from "@/lib/square";
import { buildPaymentNote } from "@/lib/square-order";
import { PAYMENT_FALLBACK_MESSAGE, paymentDeclineMessage } from "@/lib/square-web-payments";

export type PayBookingResult = { paid: true } | { error: string };

type ContactRel = { email: string | null; full_name: string | null };
type EventRel = { title: string | null; date: string | null };

function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

export async function payForBooking(input: {
  bookingId: number;
  sourceId: string;
}): Promise<PayBookingResult> {
  if (!input.sourceId || !Number.isInteger(input.bookingId)) {
    return { error: PAYMENT_FALLBACK_MESSAGE };
  }

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, status, payment_status, square_order_id, group_size,
      contacts!bookings_contact_id_fkey(email, full_name),
      events!bookings_event_id_fkey(title, date)
    `)
    .eq("id", input.bookingId)
    .maybeSingle();

  if (!booking?.square_order_id) {
    return { error: "We couldn't find this booking. Please start again." };
  }
  if (booking.payment_status === "paid") return { paid: true };
  if (booking.status === "cancelled") {
    return { error: "This booking was cancelled. Please start a new booking." };
  }

  try {
    const { order } = await squareClient.orders.get({ orderId: booking.square_order_id });
    const due = order?.netAmountDueMoney ?? order?.totalMoney;
    if (!order || !due?.amount) return { paid: true };

    const contact = unwrap(booking.contacts as ContactRel | ContactRel[] | null);
    const event = unwrap(booking.events as EventRel | EventRel[] | null);

    const { payment } = await squareClient.payments.create({
      idempotencyKey: randomUUID(),
      sourceId: input.sourceId,
      amountMoney: due,
      orderId: order.id,
      locationId: order.locationId,
      referenceId: String(booking.id),
      note: buildPaymentNote({
        bookingId: Number(booking.id),
        title: event?.title || "Event",
        groupSize: Number(booking.group_size) || 1,
        fullName: contact?.full_name ?? "",
        eventDate: event?.date,
      }),
      ...(contact?.email ? { buyerEmailAddress: contact.email } : {}),
    });

    if (payment?.status === "COMPLETED" || payment?.status === "APPROVED") {
      return { paid: true };
    }
    console.error("[payForBooking] unexpected payment status:", payment?.status);
    return { error: PAYMENT_FALLBACK_MESSAGE };
  } catch (err) {
    console.error("[payForBooking] Square payment error:", squareErrorDetail(err));
    const code = err instanceof SquareError ? err.errors?.[0]?.code : undefined;
    return { error: paymentDeclineMessage(code) };
  }
}
