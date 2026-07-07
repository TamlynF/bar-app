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

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function createEventBooking(formData: FormData) {
  const supabase = await createClient();

  const eventId = parseInt(formData.get("event_id") as string, 10);
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
    // 1. Fetch event and verify it's bookable
    const { data: event } = await supabase
      .from("events")
      .select("id, date, title, payment_amount, seating_required, is_fully_booked, is_active, is_bookable")
      .eq("id", eventId)
      .single();

    if (!event || !event.is_active || !event.is_bookable) {
      return { error: "This event is not available for booking." };
    }

    if (event.is_fully_booked) {
      return { error: "This event is fully booked." };
    }

    const paymentAmountPence = Math.round((event.payment_amount || 0) * 100);
    const isFree = paymentAmountPence === 0;

    // 2. Table allocation — route through the shared module (seated events only).
    let chosenTable: FreeTable | null = null;
    let status: "confirmed" | "waitlisted" = "confirmed";
    if (seatingApplies(event)) {
      const allocation = await allocateOnCreate(supabase, { eventId, groupSize });
      status = allocation.status;
      chosenTable = allocation.status === "confirmed" ? allocation.table : null;
    }

    // 3. Upsert contact
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
        .insert([{ full_name: fullName, email, country_code: countryCode, phone_no: phoneNo }])
        .select("id")
        .single();
      if (contactError || !newContact) throw new Error("Failed to save contact.");
      contactId = newContact.id;
    }

    const totalPence = paymentAmountPence * groupSize;

    // 4. Create booking
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
      throw new Error(`Failed to create booking: ${bookingError?.message || "unknown error"}`);
    }

    // 5. Table mapping — commit with the unique-index concurrency backstop.
    if (chosenTable) {
      const mapped = await commitMapping(supabase, {
        bookingId: newBooking.id,
        eventId,
        tableId: chosenTable.id,
        groupSize,
      });
      if (!mapped.ok) {
        // Lost the last table to a concurrent booking — waitlist this one.
        status = "waitlisted";
        if (isFree) {
          await supabase.from("bookings").update({ status: "waitlisted" }).eq("id", newBooking.id);
        }
        // Paid path: the square_order_id update below persists the new status.
      }
    }

    // 6. Free booking — confirm immediately
    if (isFree) {
      await sendEventBookingEmail(
        newBooking.id, email, fullName, event.title || "Event", event.date, groupSize, status, 0, 0
      );
      await updateFullyBookedStatus(supabase, eventId);
      revalidatePath("/dashboard");
      return { success: true };
    }

    // 7. Create Square Payment Link
    const { paymentLink } = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [{
          name: `${event.id}:${event.title} — ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`,
          quantity: String(groupSize),
          basePriceMoney: {
            amount: BigInt(paymentAmountPence),
            currency: "GBP",
          },
        }],
      },
      checkoutOptions: {
        redirectUrl: `${appUrl}/book/event/${eventId}/success?bookingId=${newBooking.id}`,
        merchantSupportEmail: "admin@bookingsdonfenticas.co.uk",
      },
    });

    const checkoutUrl = paymentLink?.url;
    const orderId = paymentLink?.orderId;

    if (!checkoutUrl) {
      await supabase.from("booking_table_mappings").delete().eq("booking_id", newBooking.id);
      await supabase.from("bookings").delete().eq("id", newBooking.id);
      throw new Error("Failed to create payment link. Please try again.");
    }

    // 8. Store Square order ID
    await supabase
      .from("bookings")
      .update({ square_order_id: orderId, status })
      .eq("id", newBooking.id);

    await sendEventBookingEmail(
      newBooking.id, email, fullName, event.title || "Event", event.date, groupSize, status, totalPence / 100, 0
    );

    await updateFullyBookedStatus(supabase, eventId);
    revalidatePath("/dashboard");

    return { checkoutUrl };
  } catch (err) {
    console.error("createEventBooking error:", err);
    return {
      error: err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
    };
  }
}

async function sendEventBookingEmail(
  bookingId: number,
  email: string,
  name: string,
  eventTitle: string,
  bookingDate: string,
  groupSize: number,
  status: "confirmed" | "waitlisted",
  totalAmount: number | string,
  paidAmount: number | string
) {
  const manageUrl = `${appUrl}/manage-booking/${bookingId}`;

  const subject = status === "confirmed"
    ? `🎫 Booking Confirmed: ${eventTitle} @ Don Fenticas`
    : `📋 You're on the Waitlist: ${eventTitle} @ Don Fenticas`;

  const content = status === "confirmed"
    ? `Your spot for <strong>${eventTitle}</strong> is officially secured for ${groupSize} ${groupSize === 1 ? "person" : "people"}.`
    : `We're currently fully booked for this date, so you've been added to our waitlist. We'll notify you immediately if a spot opens up!`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F7F4EA; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #E6DFC8;">
        <div style="background-color: #26300D; padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">${eventTitle}</h1>
          <p style="color: #FDCC4B; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Don Fenticas</p>
        </div>
        <div style="padding: 40px 30px; color: #1F1F1A;">
          <h2 style="margin-top: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">Hey ${name}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #5F624F; font-weight: 500;">${content}</p>
          <div style="background-color: #F7F4EA; border: 2px solid #E6DFC8; border-radius: 16px; padding: 24px; margin: 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">📅 Date</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${bookingDate}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">🏷️ Name</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${name}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">👥 Tickets</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${groupSize} ${groupSize === 1 ? "Person" : "People"}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">ℹ️ Status</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A; text-transform: capitalize;">${status}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">💷 Total</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">£${Number(totalAmount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">💳 Paid</td>
                <td style="text-align: right; font-weight: 900; color: #1F1F1A;">£${Number(paidAmount).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; margin: 40px 0 20px 0;">
            <a href="${manageUrl}" style="background-color: #FDCC4B; color: #26300D; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">Manage Booking</a>
          </div>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Button not working? Copy and paste this link:<br>
            <a href="${manageUrl}" style="color: #26300D; text-decoration: underline; margin-top: 8px; display: inline-block;">${manageUrl}</a>
          </p>
        </div>
        <div style="background-color: #1F1F1A; padding: 30px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #E6DFC8; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; opacity: 0.6;">Don Fenticas · Licensed Venue</p>
        </div>
      </div>
    </div>
  `;

  try {
    const { error: resendError } = await resend.emails.send({
      from: "Don Fenticas <admin@bookingsdonfenticas.co.uk>",
      to: email,
      subject,
      html,
    });
    if (resendError) {
      console.error("Resend API Error:", resendError);
    }
  } catch (emailError) {
    console.error("Email failed (non-blocking):", emailError);
  }
}
