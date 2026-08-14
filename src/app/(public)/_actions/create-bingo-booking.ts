"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import {
  allocateOnCreate,
  commitMapping,
  seatingApplies,
  type FreeTable,
} from "@/lib/table-allocation";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import {
  buildPaymentPendingEmail,
  paymentPendingMergeValues,
} from "@/lib/payment-pending-email";
import { buildBookingConfirmedEmail, formatEventDate } from "@/lib/booking-emails";
import { renderTemplate } from "@/lib/email/resolve";
import { notifyAdminBookingCreated } from "@/lib/booking-notifications";
import { checkoutReturnPath } from "@/lib/booking-links";
import { buildCheckoutOptions } from "@/lib/square-order";
import { getContactEmail } from "@/lib/company-info";
import { EMAIL_FROM } from "@/lib/email";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);


export async function createBingoBooking(formData: FormData) {
  const supabase = await createClient();

  const eventId = Number(formData.get("event_id"));
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const countryCode = (formData.get("country_code") as string) || null;
  const phoneNo = (formData.get("phone_no") as string) || null;
  const groupSize = parseInt(formData.get("group_size") as string, 10);
  const specialRequests = (formData.get("special_requests") as string) || null;
  const groupName = (formData.get("group_name") as string) || fullName;

  if (!eventId || !fullName || !email || !groupSize || groupSize < 1) {
    return { error: "Please fill in all required fields." };
  }

  try {
    const { data: eventRow, error: eventLookupError } = await supabase
      .from("events")
      .select("id, date, payment_amount, seating_required, is_bookable")
      .eq("id", eventId)
      .single();

    if (eventLookupError || !eventRow) {
      return { error: "We couldn't find that event. Please pick another date." };
    }

    const eventDate = eventRow.date as string;
    const paymentAmount = Math.round((eventRow.payment_amount ?? 0) * 100);
    const isFree = paymentAmount === 0;

    let chosenTable: FreeTable | null = null;
    let status: "confirmed" | "waitlisted" = "confirmed";
    if (isFree && seatingApplies(eventRow)) {
      const allocation = await allocateOnCreate(supabase, { eventId, groupSize });
      status = allocation.status;
      chosenTable = allocation.status === "confirmed" ? allocation.table : null;
    }

    let contactId: number;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert([{
          full_name: fullName,
          email,
          country_code: countryCode,
          phone_no: phoneNo,
        }])
        .select("id")
        .single();
      if (contactError || !newContact) throw new Error("Failed to save contact.");
      contactId = newContact.id;
    }

    const totalPence = paymentAmount * groupSize;

    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        event_id: eventId,
        contact_id: contactId,
        group_name: groupName,
        group_size: groupSize,
        status: isFree ? status : "pending",
        payment_status: isFree ? "paid" : "unpaid",
        special_requests: specialRequests,
        paid_amount: 0,
        total_amount: totalPence / 100,
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      console.error("Booking insert error:", JSON.stringify(bookingError, null, 2));
      throw new Error(`Failed to create booking: ${bookingError?.message || "unknown error"}`);
    }

    if (chosenTable) {
      const mapped = await commitMapping(supabase, {
        bookingId: newBooking.id,
        eventId,
        tableId: chosenTable.id,
        groupSize,
      });
      if (!mapped.ok) {
        status = "waitlisted";
        await supabase.from("bookings").update({ status: "waitlisted" }).eq("id", newBooking.id);
      }
    }

    if (isFree) {
      await sendBookingEmail(
        supabase, newBooking.id, email, fullName, eventDate, groupSize, status, 0, 0
      );
      await notifyAdminBookingCreated(newBooking.id);
      await updateFullyBookedStatus(supabase, eventId);
      revalidatePath("/dashboard");
      revalidatePath(`/book/bingo/manage-booking/${newBooking.id}`);
      return { success: true };
    }

    const [firstName, ...restName] = fullName.trim().split(/\s+/);
    const lastName = restName.join(" ") || undefined;
    const buyerPhone = phoneNo ? `${countryCode ?? ""}${phoneNo}`.trim() : undefined;

    const { paymentLink } = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        referenceId: String(newBooking.id),
        metadata: { booking_id: String(newBooking.id), event_id: String(eventId) },
        lineItems: [{
          name: `Music Bingo - ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`,
          quantity: String(groupSize),
          basePriceMoney: {
            amount: BigInt(paymentAmount),
            currency: "GBP",
          },
        }],
        fulfillments: [{
          type: "PICKUP",
          state: "PROPOSED",
          pickupDetails: {
            scheduleType: "ASAP",
            recipient: {
              displayName: fullName,
              emailAddress: email,
              ...(buyerPhone ? { phoneNumber: buyerPhone } : {}),
            },
          },
        }],
      },
      checkoutOptions: buildCheckoutOptions({
        redirectUrl: `${appUrl}/book/bingo/success?bookingId=${newBooking.id}`,
        supportEmail: await getContactEmail(),
      }),
      prePopulatedData: {
        buyerEmail: email,
        ...(buyerPhone ? { buyerPhoneNumber: buyerPhone } : {}),
        buyerAddress: { firstName, lastName },
      },
    });

    console.log("Square Payment Link created:", paymentLink); 
    const checkoutUrl = paymentLink?.url;
    const orderId = paymentLink?.orderId;

    if (!checkoutUrl) {
      await supabase.from("booking_table_mappings").delete().eq("booking_id", newBooking.id);
      await supabase.from("bookings").delete().eq("id", newBooking.id);
      throw new Error("Failed to create payment link. Please try again.");
    }

    await supabase
      .from("bookings")
      .update({ square_order_id: orderId })
      .eq("id", newBooking.id);

    await sendPaymentPendingEmail(supabase, {
      bookingId: newBooking.id,
      eventId,
      email,
      name: fullName,
      eventDate,
      groupSize,
      amountDue: totalPence / 100,
    });

    revalidatePath("/dashboard");
    revalidatePath("/book/bingo/success");
    revalidatePath(`/book/bingo/manage-booking/${newBooking.id}`);

    return { checkoutUrl };
  } catch (err) {
    console.error("createBingoBooking error:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
    };
  }
}

async function sendPaymentPendingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    bookingId: number;
    eventId: number;
    email: string;
    name: string;
    eventDate: string;
    groupSize: number;
    amountDue: number;
  }
) {
  const slots = await renderTemplate(
    supabase,
    "booking.payment_pending",
    paymentPendingMergeValues({
      name: args.name,
      eventTitle: "Music Bingo",
      eventDate: args.eventDate,
      groupSize: args.groupSize,
      amountDue: args.amountDue,
    })
  );
  if (!slots) return;

  const { subject, html } = buildPaymentPendingEmail({
    slots,
    eventDate: args.eventDate,
    groupSize: args.groupSize,
    amountDue: args.amountDue,
    payUrl: `${appUrl}${checkoutReturnPath({
      eventId: args.eventId,
      bookingId: args.bookingId,
    })}`,
  });

  try {
    const { error: resendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.email,
      subject,
      html,
    });
    if (resendError) console.error("Resend API Error:", resendError);
  } catch (emailError) {
    console.error("Email failed (non-blocking):", emailError);
  }
}

async function sendBookingEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  booking_id: number,
  email: string,
  name: string,
  booking_date: string,
  group_size: number,
  status: "confirmed" | "waitlisted",
  total_amount: number | string,
  paid_amount: number | string
) {
  const manageUrl = `${appUrl}/book/bingo/manage-booking/${booking_id}`;
  const partySize = `${group_size} ${group_size === 1 ? "Person" : "People"}`;

  const slots = await renderTemplate(
    supabase,
    status === "confirmed" ? "booking.bingo.confirmed" : "booking.bingo.waitlisted",
    {
      customerName: name,
      eventTitle: "Music Bingo",
      eventDate: formatEventDate(booking_date),
      groupName: name,
      groupSize: partySize,
      bookingId: String(booking_id),
      contactEmail: await getContactEmail(),
    }
  );
  if (!slots) return;

  /* Free and paid bingo bookings now build on the same shell as every other
     booking email, rather than the copy of it this file used to carry. */
  const { subject, html } = buildBookingConfirmedEmail({
    slots,
    rows: [
      { label: "📅 Date", value: formatEventDate(booking_date) },
      { label: "🏷️ Name", value: name },
      { label: "👥 Tickets", value: partySize },
      { label: "ℹ️ Status", value: status },
      { label: "💷 Total Amount", value: `£${Number(total_amount).toFixed(2)}` },
      { label: "💳 Paid Amount", value: `£${Number(paid_amount).toFixed(2)}` },
    ],
    manageUrl,
  });

  try {
      const { error: resendError } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: subject,
        html: html
      });

      if (resendError) {
        console.error("Resend API Error:", resendError);
        throw new Error(`Booking saved, but email failed: ${resendError.message}`)
      }

    } catch (emailError) {
      console.error("Email failed:", emailError);
      const errorMessage = emailError instanceof Error 
        ? emailError.message 
        : typeof emailError === "string" 
          ? emailError 
          : JSON.stringify(emailError);
      
      throw new Error(`Booking saved, but email failed: ${errorMessage}`);
    }
}
