"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";

interface BookingFormData {
  event_id: number;
  name: string;
  team_name: string;
  team_size: number;
  email: string;
  phone?: string;
  special_requests?: string; // Added field
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Validates if a team name is available for a specific event date.
 */
export async function checkTeamName(teamName: string, quizDate: string, excludeBookingId?: string | number) {
  if (!teamName || !quizDate) return { isAvailable: true };
  
  const supabase = await createClient();

  // 1. Resolve the event ID(s) for the chosen date. There can be more than one
  //    event on a date (e.g. two sessions), so check team-name uniqueness across
  //    all of them — and never use .maybeSingle() here (it errors on >1 row).
  const { data: eventRows } = await supabase
    .from('events')
    .select('id')
    .eq('date', quizDate);

  const eventIds = (eventRows ?? []).map((e) => e.id);

  // If no event exists yet for that date, the name is available by default
  if (eventIds.length === 0) return { isAvailable: true };

  // 2. Query for active bookings with the same name (ignoring case and cancelled entries)
  let query = supabase
    .from("bookings")
    .select("id")
    .in("event_id", eventIds)
    .ilike("group_name", teamName.trim())
    .not("status", "eq", "cancelled");

  // Exclude current record if we are validating an existing booking modification
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data: duplicateTeam } = await query.limit(1).maybeSingle();

  return { isAvailable: !duplicateTeam };
}

/**
 * Checks if there are any available tables for a given date and group size.
 */
export async function checkQuizAvailability(quizDate: string, teamSize: number): Promise<{ available: boolean }> {
  if (!quizDate) return { available: true };
  const supabase = await createClient();

  // Find the event for this date
  const { data: eventData } = await supabase
    .from('events')
    .select('id, event_subtypes!inner(behavior)')
    .eq('date', quizDate)
    .eq('event_subtypes.behavior', 'quiz')
    .maybeSingle();

  // No event yet = available (it'll be created on booking)
  if (!eventData) return { available: true };

  // Find confirmed/waitlisted bookings for this event
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('event_id', eventData.id)
    .in('status', ['confirmed', 'waitlisted']);

  const bookingIds = bookings?.map(b => b.id) || [];

  // Find tables already in use
  let tablesInUse: number[] = [];
  if (bookingIds.length > 0) {
    const { data: mappings } = await supabase
      .from('booking_table_mappings')
      .select('table_id')
      .in('booking_id', bookingIds);
    tablesInUse = mappings?.map(m => m.table_id) || [];
  }

  // Find suitable tables not in use
  const { data: suitableTables } = await supabase
    .from('tables')
    .select('id, max_capacity')
    .gte('max_capacity', teamSize)
    .order('max_capacity', { ascending: true });

  const availableTable = suitableTables?.find(t => !tablesInUse.includes(t.id));
  return { available: !!availableTable };
}

export async function createBooking(formData: BookingFormData) {
  console.log(formData);
  const supabase = await createClient();

  try {
    // Resolve the chosen event by its unique id (the form sends event_id). Two
    // events can share a date, so we must target the exact one, not look up by date.
    const { data: eventRow, error: eventLookupError } = await supabase
      .from('events')
      .select('id, date')
      .eq('id', formData.event_id)
      .single();

    if (eventLookupError || !eventRow) throw new Error("Failed to resolve event context.");

    const eventId = eventRow.id;
    const quizDate = eventRow.date as string;

    const { isAvailable } = await checkTeamName(formData.team_name, quizDate);
    if (!isAvailable) throw new Error('This team name was just reserved by another user. Please choose a different name.');

    // TABLE ALLOCATION LOGIC
    const { data: conflictingBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    if (bookingsError) throw new Error("Error fetching existing bookings: " + bookingsError.message);
    console.log(conflictingBookings);

    const conflictingBookingIds = conflictingBookings?.map((b) => b.id) || [];

    // 3. Find which tables are currently mapped to those conflicting bookings
    let tablesInUse: number[] = [];
    if (conflictingBookingIds.length > 0) {
      const { data: mappings, error: mappingsError } = await supabase
        .from("booking_table_mappings")
        .select("table_id")
        .in("booking_id", conflictingBookingIds);

      if (mappingsError) throw new Error("Error fetching table mappings: " + mappingsError.message);
      tablesInUse = mappings?.map((m) => m.table_id) || [];
    }

    //console.log(tablesInUse);

    // 4. Find all tables with enough capacity, ordering by smallest suitable table first 
    const { data: suitableTables, error: tablesError } = await supabase
      .from("tables")
      .select("id, max_capacity")
      .gte("max_capacity", formData.team_size)
      .order("max_capacity", { ascending: true });

    if (tablesError) throw new Error("Error fetching tables: " + tablesError.message);

    // 5. Pick the first suitable table that isn't already in use
    const availableTable = suitableTables?.find((table) => !tablesInUse.includes(table.id));
    //console.log(availableTable);

    // 6. Set the booking status based on table availability
    const status = availableTable ? "confirmed" : "waitlisted";
    const isWaitlisted = status === "waitlisted";

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
        .insert([{
            full_name: formData.name,
            email: formData.email,
            phone_no: formData.phone || null
        }])
        .select("id")
        .single();

      if (contactError) {
        console.error("Contact insert error:", contactError);
        throw new Error('Failed to save booking')
        //return { success: false, error: "Failed to save contact details." };
      }
      contactId = newContact?.id;
    }

    if (!contactId) throw new Error("Failed to save lead contact.");

    // FINAL BOOKING INSERTION
    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
          event_id: eventId,
          contact_id: contactId,
          group_name: formData.team_name,
          group_size: formData.team_size,
          status: status,
          special_requests: formData.special_requests || null, // Map to DB column
          paid_amount: 0,
          // Note: Omitting team_id as it appears to be optional or handled elsewhere.
          // If Supabase complains about team_id being required, you will need a 4th step for 'teams'.
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      console.error("Supabase insert error:", bookingError);
      throw new Error("Error creating booking: " + bookingError.message)
      //return { success: false, error: bookingError?.message };
    }

    // TABLE MAPPING
    if (status === "confirmed" && availableTable) {
      const { error: mappingInsertError } = await supabase
        .from("booking_table_mappings")
        .insert({
          booking_id: newBooking.id,
          table_id: availableTable.id,
        });

      if (mappingInsertError) {
        console.error("Failed to map table:", mappingInsertError);
        // Optional: you could update the booking status to an error state or alert an admin here
      }
    }

    // 9. Send the confirmation or waitlist email.
    // A failed email must NOT discard an already-saved booking, so swallow errors here.
    try {
      await sendBookingEmail(newBooking.id, formData.email, formData.name, quizDate, formData.team_name, formData.team_size, status);
    } catch (emailError) {
      console.error("Booking saved but confirmation email failed:", emailError);
    }

    // 10. Update fully booked status
    await updateFullyBookedStatus(supabase, eventId);

    // 11. Revalidate paths so the UI updates with the new booking
    revalidatePath("/dashboard");
    revalidatePath("/book/quiz/manage-booking");

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
    throw new Error(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.");
    //return { success: false, error: error.message || "An unexpected error occurred. Please try again." };
  }
}

/**
 * Helper function to handle sending emails.
 * Uses environment variables to build the correct public URLs for Vercel.
 */
async function sendBookingEmail(
  booking_id: number,
  email: string,
  name: string,
  quiz_date: string,
  team_name: string,
  team_size: number,
  status: "confirmed" | "waitlisted"
) {
  // Logic to determine the correct base URL
  // 1. Explicit variable (Best for custom domains)
  // 2. Vercel deployment URL (Automatic backup)
  // 3. Localhost (Development fallback)
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL 
    ? process.env.NEXT_PUBLIC_SITE_URL 
    : process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

  const manageUrl = `${appUrl}/book/quiz/manage-booking/${booking_id}`;
  
  const subject = status === "confirmed" ? "Quiz Night Table Confirmed! 🎉" : "You are on the Waitlist";
  const content = status === "confirmed" 
    ? `Great news! Your team "${team_name}" is locked in.` 
    : `We're currently full, so "${team_name}" has been added to our waitlist.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h2 style="margin-top: 0; color: #111827;">Hey ${name}!</h2>
        <p>${content}</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 Date:</strong> ${quiz_date}</p>
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