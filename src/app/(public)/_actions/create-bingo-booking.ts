"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import { Resend } from "resend";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);

// Price per person in pence (e.g. 500 = £5.00)
const PRICE_PER_PERSON_PENCE = parseInt(
  process.env.BINGO_PRICE_PER_PERSON_PENCE ?? "500",
  10
);

export async function createBingoBooking(formData: FormData) {
  const supabase = await createClient();

  const eventDate = formData.get("event_date") as string;
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const countryCode = (formData.get("country_code") as string) || null;
  const phoneNo = (formData.get("phone_no") as string) || null;
  const groupSize = parseInt(formData.get("group_size") as string, 10);
  const specialRequests = (formData.get("special_requests") as string) || null;

  if (!eventDate || !fullName || !email || !groupSize || groupSize < 1) {
    return { error: "Please fill in all required fields." };
  }

  try {
    // 1. Resolve bingo event type
    let eventTypeId: number;
    const { data: existingType } = await supabase
      .from("event_types")
      .select("id")
      .eq("type", "game")
      .eq("sub_type", "bingo")
      .maybeSingle();

    if (existingType) {
      eventTypeId = existingType.id;
    } else {
      const { data: newType, error: typeError } = await supabase
        .from("event_types")
        .insert([{ type: "game", sub_type: "bingo" }])
        .select("id")
        .single();
      if (typeError || !newType) throw new Error("Failed to setup event type.");
      eventTypeId = newType.id;
    }

    // 2. Resolve event for this date
    let eventId: number;
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id, payment_amount")
      .eq("date", eventDate)
      .eq("event_types_id", eventTypeId)
      .maybeSingle();

    if (existingEvent) {
      eventId = existingEvent.id;
    } else {
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([{
          date: eventDate,
          title: "Music Bingo",
          description: "Live Music Bingo Night",
          event_types_id: eventTypeId,
          payment_amount: PRICE_PER_PERSON_PENCE / 100,
        }])
        .select("id")
        .single();
      if (eventError || !newEvent) throw new Error("Failed to setup event.");
      eventId = newEvent.id;
    }

    // 3. Table allocation — same logic as quiz booking
    const { data: confirmedBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    const confirmedIds = confirmedBookings?.map((b) => b.id) || [];

    let tablesInUse: number[] = [];
    if (confirmedIds.length > 0) {
      const { data: mappings } = await supabase
        .from("booking_table_mappings")
        .select("table_id")
        .in("booking_id", confirmedIds);
      tablesInUse = mappings?.map((m) => m.table_id) || [];
    }

    const { data: suitableTables } = await supabase
      .from("tables")
      .select("id, max_capacity")
      .gte("max_capacity", groupSize)
      .order("max_capacity", { ascending: true });

    const availableTable = suitableTables?.find(
      (t) => !tablesInUse.includes(t.id)
    );
    const status = availableTable ? "confirmed" : "waitlisted";

    // 4. Upsert contact
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

    const totalPence = PRICE_PER_PERSON_PENCE * groupSize;

    // 5. Create pending booking
    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        event_id: eventId,
        contact_id: contactId,
        group_name: fullName,
        group_size: groupSize,
        status: "pending",
        payment_status: "unpaid",
        special_requests: specialRequests,
        paid_amount: 0,
        total_amount: totalPence / 100,
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      throw new Error("Failed to create booking.");
    }

    // 6. Table mapping (tentative — confirmed on payment)
    if (availableTable) {
      await supabase.from("booking_table_mappings").insert({
        booking_id: newBooking.id,
        table_id: availableTable.id,
      });
    }

    // 7. Create Square Payment Link
    const { paymentLink } = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [{
          name: `Music Bingo — ${groupSize} ticket${groupSize !== 1 ? "s" : ""}`,
          quantity: String(groupSize),
          basePriceMoney: {
            amount: BigInt(PRICE_PER_PERSON_PENCE),
            currency: "GBP",
          },
        }],
      },
      checkoutOptions: {
        redirectUrl: `${appUrl}/book/bingo/success?bookingId=${newBooking.id}`,
        merchantSupportEmail: "admin@bookingsdonfenticas.co.uk",
      },
    });

    const checkoutUrl = paymentLink?.url;
    const orderId = paymentLink?.orderId;

    if (!checkoutUrl) {
      // Clean up booking if Square fails
      await supabase.from("booking_table_mappings").delete().eq("booking_id", newBooking.id);
      await supabase.from("bookings").delete().eq("id", newBooking.id);
      throw new Error("Failed to create payment link. Please try again.");
    }

    // 8. Store Square order ID on booking
    await supabase
      .from("bookings")
      .update({ square_order_id: orderId, status })
      .eq("id", newBooking.id);

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
async function sendBookingEmail(
  booking_id: number,
  email: string,
  name: string,
  booking_date: string,
  team_name: string,
  team_size: number,
  status: "confirmed" | "waitlisted"
) {

  const manageUrl = `${appUrl}/book/quiz/manage-booking/${booking_id}`;
  
  const subject = status === "confirmed" ? "Music Bingo Booking Confirmed! 🎉" : "You are on the Waitlist";
  const content = status === "confirmed" 
    ? `Great news! Your team "${team_name}" is locked in.` 
    : `We're currently full, so "${team_name}" has been added to our waitlist.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h2 style="margin-top: 0; color: #111827;">Hey ${name}!</h2>
        <p>${content}</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 Date:</strong> ${booking_date}</p>
          <p><strong>🍺 Team:</strong> ${team_name}</p>
          <p><strong>👥 Size:</strong> ${team_size} people</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${manageUrl}" style="background-color: #fdcc4b; color: #26300d; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-transform: uppercase;">Manage Booking</a>
        </div>
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          If the button doesn't work, copy this link: ${manageUrl}
        </p>
      </div>
    </div>
  `;

  try {
      const { error: resendError } = await resend.emails.send({
      from: 'Don Fenticas <admin@bookingsdonfenticas.co.uk>',
        to: email,
        subject: subject,
        html: html
      });

      if (resendError) {
        console.error("Resend API Error:", resendError);
        throw new Error(`Booking saved, but email failed: ${resendError.message}`)
        //return { success: false, error: `Booking saved, but email failed: ${resendError.message}` };
      }

    } catch (emailError) {
    console.error("Email failed:", emailError);
      const errorMessage = emailError instanceof Error 
        ? emailError.message 
        : typeof emailError === "string" 
          ? emailError 
          : JSON.stringify(emailError);
      
      throw new Error(`Booking saved, but email failed: ${errorMessage}`);
      //return { success: false, error: `Booking saved, but email failed: ${emailError.message || JSON.stringify(emailError)}` };
    }
}