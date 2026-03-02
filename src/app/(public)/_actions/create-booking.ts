"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

// Initialize the Resend client using your environment variable
const resend = new Resend(process.env.RESEND_API_KEY);


export async function createBooking(formData: {
  quiz_date: string;
  name: string;
  team_name: string;
  team_size: number;
  email: string;
  phone?: string;
}) {
    console.log(formData);
  try {
    const supabase = await createClient();

    // 1. Handle Contact (Find existing or create new)
    let contactId;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", formData.email)
      .maybeSingle(); // maybeSingle returns null instead of an error if not found

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert([
          { 
            full_name: formData.name, 
            email: formData.email, 
            phone_no: formData.phone || null 
          }
        ])
        .select("id")
        .single();

      if (contactError) {
        console.error("Contact insert error:", contactError);
        return { success: false, error: "Failed to save contact details." };
      }
      contactId = newContact.id;
    }

    // 2. Handle Event Type (Find existing 'quiz' or create new to get next ID)
    let eventTypeId;
    const { data: existingEventType } = await supabase
      .from("event_types")
      .select("id")
      .eq("type", "game")
      .eq("sub_type", "quiz")
      .maybeSingle();

    if (existingEventType) {
      eventTypeId = existingEventType.id;
    } else {
      // If not found, insert a new record. The database will automatically increment and assign the next ID.
      const { data: newEventType, error: typeError } = await supabase
        .from("event_types")
        .insert([
          { 
            type: "game", 
            sub_type: "quiz" 
          }
        ])
        .select("id")
        .single();

      if (typeError) {
        console.error("Event type insert error:", typeError);
        return { success: false, error: "Failed to setup event type." };
      }
      eventTypeId = newEventType.id;
    }

    // 3. Handle Event (Find existing for this date or create new)
    let eventId;
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id")
      .eq("date", formData.quiz_date)
      .maybeSingle();

    if (existingEvent) {
      eventId = existingEvent.id;
    } else {
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([
          { 
            date: formData.quiz_date, 
            title: "Quiz Night", 
            description: "Thursday Night Quiz Night", 
            event_types_id: eventTypeId 
          }
        ])
        .select("id")
        .single();

      if (eventError) {
        console.error("Event insert error:", eventError);
        return { success: false, error: "Failed to setup event." };
      }
      eventId = newEvent.id;
    }

    // 4. Create the actual Booking
    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          event_id: eventId,
          contact_id: contactId,
          group_name: formData.team_name,
          group_size: formData.team_size,
          status: "confirmed",
          paid_amount: 0,
          // Note: Omitting team_id as it appears to be optional or handled elsewhere.
          // If Supabase complains about team_id being required, you will need a 4th step for 'teams'.
        },
      ])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      console.error("Supabase insert error:", bookingError);
      return { success: false, error: bookingError?.message };
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const manageUrl = `${appUrl}/manage-booking/${newBooking.id}`;

    // 5. Send Confirmation Email
    try {
      const { error: resendError } = await resend.emails.send({
        // Note: You will need to verify a domain in Resend and update this "from" address
        from: 'Quiz Night <admin@bookingsdonfenticas.co.uk>', 
        to: formData.email,
        subject: 'Quiz Night Table Confirmed! 🎉',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 40px 20px; border-radius: 12px; color: #1f2937;">
            <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827; font-size: 24px;">You're locked in, ${formData.name}! 🍻</h2>
              <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                We've successfully reserved a table for your team. Here are your booking details for the upcoming Quiz Night:
              </p>

              <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-size: 16px;"><strong>📅 Date:</strong> ${formData.quiz_date}</p>
                <p style="margin: 0 0 12px 0; font-size: 16px;"><strong>👥 Team Name:</strong> ${formData.team_name}</p>
                <p style="margin: 0; font-size: 16px;"><strong>🎟️ Team Size:</strong> ${formData.team_size} people</p>
              </div>

              <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                Please aim to arrive a bit early to grab drinks and settle in before the quiz starts. See you there!
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${manageUrl}" style="background-color: #fdcc4b; color: #26300d; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; font-size: 14px;">Manage or Cancel Booking</a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

              <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
                If the button above doesn't work, copy and paste this link into your browser:<br/>
                <a href="${manageUrl}" style="color: #3b82f6; text-decoration: underline; word-break: break-all; margin-top: 8px; display: inline-block;">${manageUrl}</a>
              </p>
            </div>
          </div>
        `,
      });

      if (resendError) {
        console.error("Resend API Error:", resendError);
        return { success: false, error: `Booking saved, but email failed: ${resendError.message}` };
      }

    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (emailError: any) {
      console.error("Failed to execute email send:", emailError);
      return { success: false, error: `Booking saved, but email failed: ${emailError.message || JSON.stringify(emailError)}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}