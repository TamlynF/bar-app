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
    const { error: bookingError } = await supabase
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
      ]);

    if (bookingError) {
      console.error("Supabase insert error:", bookingError);
      return { success: false, error: bookingError.message };
    }

    // 5. Send Confirmation Email
    try {
      const { error: resendError } = await resend.emails.send({
        // Note: You will need to verify a domain in Resend and update this "from" address
        from: 'Quiz Night <admin@bookingsdonfenticas.co.uk>', 
        to: formData.email,
        subject: 'Quiz Night Table Confirmed! 🎉',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>You're locked in, ${formData.name}!</h2>
            <p>We've successfully reserved a table for your team for our upcoming Quiz Night.</p>
            <ul>
              <li><strong>Date:</strong> ${formData.quiz_date}</li>
              <li><strong>Team Name:</strong> ${formData.team_name}</li>
              <li><strong>Team Size:</strong> ${formData.team_size} people</li>
            </ul>
            <p>Please aim to arrive a bit early to grab drinks before the quiz starts. See you there!</p>
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