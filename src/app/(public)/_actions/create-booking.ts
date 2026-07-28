"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { notifyAdminBookingCreated } from "@/lib/booking-notifications";
import {
  allocateOnCreate,
  commitMapping,
  getFreeTablesForEvent,
  seatingApplies,
  type FreeTable,
} from "@/lib/table-allocation";

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

export async function checkTeamName(teamName: string, quizDate: string, excludeBookingId?: string | number) {
  if (!teamName || !quizDate) return { isAvailable: true };
  
  const supabase = await createClient();

  const { data: eventRows } = await supabase
    .from('events')
    .select('id')
    .eq('date', quizDate);

  const eventIds = (eventRows ?? []).map((e) => e.id);

  if (eventIds.length === 0) return { isAvailable: true };

  let query = supabase
    .from("bookings")
    .select("id")
    .in("event_id", eventIds)
    .ilike("group_name", teamName.trim())
    .not("status", "eq", "cancelled");

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data: duplicateTeam } = await query.limit(1).maybeSingle();

  return { isAvailable: !duplicateTeam };
}

export async function checkQuizAvailability(quizDate: string, teamSize: number): Promise<{ available: boolean }> {
  if (!quizDate) return { available: true };
  const supabase = await createClient();

  const { data: eventData } = await supabase
    .from('events')
    .select('id, event_subtypes!inner(behavior)')
    .eq('date', quizDate)
    .eq('event_subtypes.behavior', 'quiz')
    .maybeSingle();

  if (!eventData) return { available: true };

  const freeTables = await getFreeTablesForEvent(supabase, eventData.id, { groupSize: teamSize });
  return { available: freeTables.length > 0 };
}

export async function createBooking(formData: BookingFormData) {
  console.log(formData);
  const supabase = await createClient();

  try {
    const { data: eventRow, error: eventLookupError } = await supabase
      .from('events')
      .select('id, date, seating_required, is_bookable')
      .eq('id', formData.event_id)
      .single();

    if (eventLookupError || !eventRow) throw new Error("Failed to resolve event context.");

    const eventId = eventRow.id;
    const quizDate = eventRow.date as string;

    const { isAvailable } = await checkTeamName(formData.team_name, quizDate);
    if (!isAvailable) throw new Error('This team name was just reserved by another user. Please choose a different name.');

    let finalStatus: "confirmed" | "waitlisted" = "confirmed";
    let chosenTable: FreeTable | null = null;
    if (seatingApplies(eventRow)) {
      const allocation = await allocateOnCreate(supabase, {
        eventId,
        groupSize: formData.team_size,
      });
      finalStatus = allocation.status;
      chosenTable = allocation.status === "confirmed" ? allocation.table : null;
    }

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
      }
      contactId = newContact?.id;
    }

    if (!contactId) throw new Error("Failed to save lead contact.");

    const { data: newBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
          event_id: eventId,
          contact_id: contactId,
          group_name: formData.team_name,
          group_size: formData.team_size,
          status: finalStatus,
          special_requests: formData.special_requests || null, // Map to DB column
          paid_amount: 0,
      }])
      .select("id")
      .single();

    if (bookingError || !newBooking) {
      console.error("Supabase insert error:", bookingError);
      throw new Error("Error creating booking: " + bookingError.message)
    }

    if (chosenTable) {
      const mapped = await commitMapping(supabase, {
        bookingId: newBooking.id,
        eventId,
        tableId: chosenTable.id,
        groupSize: formData.team_size,
      });
      if (!mapped.ok) {
        finalStatus = "waitlisted";
        await supabase
          .from("bookings")
          .update({ status: "waitlisted" })
          .eq("id", newBooking.id);
      }
    }

    const isWaitlisted = finalStatus === "waitlisted";

    try {
      await sendBookingEmail(newBooking.id, formData.email, formData.name, quizDate, formData.team_name, formData.team_size, finalStatus);
    } catch (emailError) {
      console.error("Booking saved but confirmation email failed:", emailError);
    }

    await notifyAdminBookingCreated(newBooking.id);

    await updateFullyBookedStatus(supabase, eventId);

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
  }
}

async function sendBookingEmail(
  booking_id: number,
  email: string,
  name: string,
  quiz_date: string,
  team_name: string,
  team_size: number,
  status: "confirmed" | "waitlisted"
) {
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