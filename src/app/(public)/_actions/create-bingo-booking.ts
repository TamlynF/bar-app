"use server";

import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);


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
      .eq("type", "games")
      .eq("sub_type", "bingo")
      .maybeSingle();

    if (existingType) {
      eventTypeId = existingType.id;
    } else {
      const { data: newType, error: typeError } = await supabase
        .from("event_types")
        .insert([{ type: "games", sub_type: "bingo" }])
        .select("id")
        .single();
      if (typeError || !newType) throw new Error("Failed to setup event type.");
      eventTypeId = newType.id;
    }

    // 2. Resolve event for this date
    let eventId: number;
    let paymentAmount: number;
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id, payment_amount")
      .eq("date", eventDate)
      .eq("event_types_id", eventTypeId)
      .maybeSingle();

    if (existingEvent) {
      eventId = existingEvent.id;
      paymentAmount = Math.round(existingEvent.payment_amount * 100);
    } else {
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([{
          date: eventDate,
          title: "Music Bingo",
          description: "Live Music Bingo Night",
          event_types_id: eventTypeId,
          payment_amount: 0,
        }])
        .select("id")
        .single();
      if (eventError || !newEvent) throw new Error("Failed to setup event.");
      eventId = newEvent.id;
      paymentAmount = 0;
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

    const totalPence = paymentAmount * groupSize;
    const isFree = paymentAmount === 0;

    // 5. Create booking
    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        event_id: eventId,
        contact_id: contactId,
        group_name: fullName,
        group_size: groupSize,
        status: isFree ? status : "pending",
        payment_status: isFree ? "free" : "unpaid",
        special_requests: specialRequests,
        paid_amount: 0,
        total_amount: totalPence / 100,
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      throw new Error("Failed to create booking.");
    }

    // 6. Table mapping
    if (availableTable) {
      await supabase.from("booking_table_mappings").insert({
        booking_id: newBooking.id,
        table_id: availableTable.id,
      });
    }

    // 6b. Free booking — no payment required, confirm immediately
    if (isFree) {
      await sendBookingEmail(
        newBooking.id, email, fullName, eventDate, groupSize, status, 0, 0
      );
      await updateFullyBookedStatus(supabase, eventId);
      revalidatePath("/dashboard");
      revalidatePath(`/book/bingo/manage-booking/${newBooking.id}`);
      return { success: true };
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
            amount: BigInt(paymentAmount),
            currency: "GBP",
          },
        }],
      },
      checkoutOptions: {
        redirectUrl: `${appUrl}/book/bingo/success?bookingId=${newBooking.id}`,
        merchantSupportEmail: "admin@bookingsdonfenticas.co.uk",
      },
    });

    console.log("Square Payment Link created:", paymentLink); 
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

    await sendBookingEmail(
      newBooking.id,
      email,
      fullName,
      eventDate,
      groupSize,
      status,
      totalPence / 100,
      0
    );

    await updateFullyBookedStatus(supabase, eventId);
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

async function sendBookingEmail(
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
  
  const subject = status === "confirmed" 
    ? "🎫 Booking Confirmed: Music Bingo @ Don Fenticas 🎵" 
    : "📋 You're on the Waitlist: Music Bingo @ Don Fenticas";
    
  const content = status === "confirmed" 
    ? `Get ready to mark off those cards and sing along! Your spot for <strong>Music Bingo</strong> is officially secured for ${group_size} ${group_size === 1 ? 'person' : 'people'}.` 
    : `We're currently fully booked for this date, so you've been added to our waitlist. We'll notify you immediately if a spot opens up!`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F7F4EA; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #E6DFC8;">

        <!-- Header -->
        <div style="background-color: #26300D; padding: 40px 20px; text-align: center;">
          <img src="./CompanyLogo.png" alt="Company Logo" style="display: inline-block; margin-bottom: 16px; max-height: 60px;" />
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Music Bingo</h1>
          <p style="color: #FDCC4B; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Don Fenticas</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px 30px; color: #1F1F1A;">
          <h2 style="margin-top: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">Hey ${name}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #5F624F; font-weight: 500;">
            ${content}
          </p>

          <!-- Details Card -->
          <div style="background-color: #F7F4EA; border: 2px solid #E6DFC8; border-radius: 16px; padding: 24px; margin: 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">📅 Date</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${booking_date}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">🏷️ Name</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${name}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">👥 Tickets</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">${group_size} ${group_size === 1 ? 'Person' : 'People'}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">ℹ️ Status</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A; text-transform: capitalize;">${status}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">💷 Total Amount</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">£${Number(total_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">💳 Paid Amount</td>
                <td style="padding-bottom: 16px; text-align: right; font-weight: 900; color: #1F1F1A;">£${Number(paid_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">🪑 Table Name</td>
                <td style="text-align: right; font-weight: 900; color: #1F1F1A;">${name}</td>
              </tr>
            </table>
          </div>

          <!-- Action -->
          <div style="text-align: center; margin: 40px 0 20px 0;">
            <a href="${manageUrl}" style="background-color: #FDCC4B; color: #26300D; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">Manage Booking</a>
          </div>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Button not working? Copy and paste this link:<br>
            <a href="${manageUrl}" style="color: #26300D; text-decoration: underline; margin-top: 8px; display: inline-block;">${manageUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #1F1F1A; padding: 30px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #E6DFC8; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; opacity: 0.6;">
            Don Fenticas • Licensed Venue
          </p>
        </div>

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
