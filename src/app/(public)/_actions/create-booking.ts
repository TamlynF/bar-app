"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

interface BookingFormData {
  quiz_date: string;
  name: string;
  team_name: string;
  team_size: number;
  email: string;
  phone?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function createBooking(formData: BookingFormData) {
  console.log(formData);
  const supabase = await createClient();

  try {
    // 1. Get the total number of physical tables from the 'tables' table
    const { count: totalTables, error: tablesError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })

    if (tablesError) {
      console.error('Error fetching tables count:', tablesError)
      throw new Error('Could not verify table availability')
    }

    let eventId;
    let reservedCount = 0;
    const maxTables = totalTables || 9;

    const { data: eventData } = await supabase
      .from('events')
      .select('id')
      .eq('date', formData.quiz_date)
      .maybeSingle()

    if (eventData) {
      eventId = eventData.id;

      const { count: bookedCount, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

      if (countError) {
        console.error('Error counting existing bookings:', countError)
        throw new Error('Could not verify existing bookings')
      }
      reservedCount = bookedCount ?? 0;
    } else {
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
          throw new Error('Failed to setup event type.')
          //return { success: false, error: "Failed to setup event type." };
        }
        eventTypeId = newEventType.id;
      }

      // 3. Handle Event (Find existing for this date or create new)
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
        throw new Error('Failed to setup event.')
        //return { success: false, error: "Failed to setup event." };
      }
      eventId = newEvent.id;
    } 

    // 3. Determine if we have reached max capacity
    const isWaitlisted = (reservedCount ?? 0) >= maxTables;
    const status = isWaitlisted ? "waitlisted" : "confirmed";

    // 1. Handle Contact (Find existing or create new)
    let contactId;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", formData.email)
      .maybeSingle();

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
        throw new Error('Failed to save booking')
        //return { success: false, error: "Failed to save contact details." };
      }
      contactId = newContact.id;
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
          status: status,
          paid_amount: 0,
          // Note: Omitting team_id as it appears to be optional or handled elsewhere.
          // If Supabase complains about team_id being required, you will need a 4th step for 'teams'.
        },
      ])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      console.error("Supabase insert error:", bookingError);
      throw new Error(bookingError?.message)
      //return { success: false, error: bookingError?.message };
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const manageUrl = `${appUrl}/manage-booking/${newBooking.id}`;

    // 5. Send Confirmation Email
    try {
      const { error: resendError } = await resend.emails.send({
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
        throw new Error(`Booking saved, but email failed: ${resendError.message}`)
        //return { success: false, error: `Booking saved, but email failed: ${resendError.message}` };
      }

    } catch (emailError) {
      console.error("Failed to execute email send:", emailError);
      const errorMessage = emailError instanceof Error 
        ? emailError.message 
        : typeof emailError === "string" 
          ? emailError 
          : JSON.stringify(emailError);
      
      throw new Error(`Booking saved, but email failed: ${errorMessage}`);
      //return { success: false, error: `Booking saved, but email failed: ${emailError.message || JSON.stringify(emailError)}` };
    }

    revalidatePath("/dashboard");
    revalidatePath("/book");

    return {
      success: true,
      booking: newBooking,
      isWaitlisted,
      message: isWaitlisted
        ? "Warning: All tables are currently booked. You have been placed on the waitlist."
        : "Success: Your booking is confirmed!"
    };
  } catch (error) {
    console.error("Server action error:", error);
    throw new Error("An unexpected error occurred.")
    //return { success: false, error: error.message || "An unexpected error occurred." };
  }
}