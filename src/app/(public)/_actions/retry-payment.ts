"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { buildBuyerPhone, buildEventOrder, buildPrePopulatedData } from "@/lib/square-order";
import { getFreeTablesForEvent, seatingApplies, type SeatingEvent } from "@/lib/table-allocation";
import { hasVenueSpaceFor } from "@/lib/update-fully-booked";
import { releaseUnpaidBooking } from "@/lib/release-unpaid-booking";
import { checkoutReturnPath } from "@/lib/booking-links";
import { isEventBehavior, type EventBehavior } from "@/lib/event-behavior";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export type RetryPaymentResult =
  | { checkoutUrl: string }
  | { alreadyPaid: true }
  | { error: string; cancelled?: boolean };

type ContactRel = {
  full_name: string;
  email: string;
  country_code: string | null;
  phone_no: string | null;
};

type SubtypeRel = { behavior: string | null };

type EventRel = {
  id: number;
  title: string | null;
  date: string;
  payment_amount: number | null;
  seating_required: boolean;
  is_active: boolean;
  is_bookable: boolean;
  event_subtypes: SubtypeRel | SubtypeRel[] | null;
};

function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

export async function retryBookingPayment(bookingId: string | number): Promise<RetryPaymentResult> {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, event_id, group_size, status, payment_status, total_amount,
      contacts!bookings_contact_id_fkey(full_name, email, country_code, phone_no),
      events!bookings_event_id_fkey(
        id, title, date, payment_amount, seating_required, is_active, is_bookable,
        event_subtypes(behavior)
      )
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { error: "We couldn't find that booking." };
  if (booking.payment_status === "paid") return { alreadyPaid: true };
  if (booking.status === "cancelled") {
    return { error: "This booking was cancelled. Please start a new booking." };
  }

  const contact = unwrap(booking.contacts as ContactRel | ContactRel[] | null);
  const event = unwrap(booking.events as EventRel | EventRel[] | null);
  const eventId = (booking.event_id as number | null) ?? null;
  const groupSize = (booking.group_size as number) ?? 0;

  if (!event || !contact?.email || eventId == null) {
    await releaseUnpaidBooking(supabase, { bookingId, eventId });
    return { error: "This booking is no longer valid and has been cancelled.", cancelled: true };
  }

  const today = new Date().toISOString().split("T")[0];
  if (!event.is_active || !event.is_bookable || event.date < today) {
    await releaseUnpaidBooking(supabase, { bookingId, eventId });
    return {
      error: "This event is no longer open for booking, so we've cancelled your unpaid booking.",
      cancelled: true,
    };
  }

  const seated = seatingApplies(event as SeatingEvent);
  const hasSpace = seated
    ? (await getFreeTablesForEvent(supabase, eventId, { groupSize, excludeBookingId: bookingId })).length > 0
    : await hasVenueSpaceFor(supabase, eventId, groupSize, bookingId);

  if (!hasSpace) {
    await releaseUnpaidBooking(supabase, { bookingId, eventId });
    return {
      error: "There's no longer space for this group size, so we've cancelled your unpaid booking.",
      cancelled: true,
    };
  }

  const paymentAmountPence = Math.round((event.payment_amount || 0) * 100);
  if (paymentAmountPence === 0) {
    return { error: "This booking has nothing left to pay. Please contact the bar." };
  }

  const rawBehavior = unwrap(event.event_subtypes)?.behavior;
  const behavior: EventBehavior | null = isEventBehavior(rawBehavior) ? rawBehavior : null;
  const title = event.title || (behavior === "bingo" ? "Music Bingo" : "Event");
  const buyerPhone = buildBuyerPhone(contact.country_code, contact.phone_no);

  let checkoutUrl: string | undefined;
  let orderId: string | undefined;
  try {
    const { paymentLink } = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: buildEventOrder({
        locationId: process.env.SQUARE_LOCATION_ID!,
        bookingId: Number(booking.id),
        eventId,
        title,
        amountPence: paymentAmountPence,
        groupSize,
        fullName: contact.full_name,
        email: contact.email,
        buyerPhone,
      }),
      checkoutOptions: {
        redirectUrl: `${appUrl}${checkoutReturnPath({ behavior, eventId, bookingId: booking.id })}`,
        merchantSupportEmail: "admin@bookingsdonfenticas.co.uk",
      },
      prePopulatedData: buildPrePopulatedData({
        email: contact.email,
        fullName: contact.full_name,
        buyerPhone,
      }),
    });
    checkoutUrl = paymentLink?.url;
    orderId = paymentLink?.orderId;
  } catch (err) {
    console.error("[retryBookingPayment] Square payment link error:", err);
  }

  if (!checkoutUrl) {
    await releaseUnpaidBooking(supabase, { bookingId, eventId });
    return {
      error: "We still couldn't start checkout, so this booking has been cancelled. Nothing has been charged — please book again or contact the bar.",
      cancelled: true,
    };
  }

  await supabase.from("bookings").update({ square_order_id: orderId }).eq("id", booking.id);

  revalidatePath(`/manage-booking/${booking.id}`);
  revalidatePath("/dashboard");

  return { checkoutUrl };
}
