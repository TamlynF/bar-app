"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { updateFullyBookedStatus } from "@/lib/update-fully-booked";
import { notifyAdminBookingCreated } from "@/lib/booking-notifications";
import { buildBookingConfirmedEmail, formatEventDate } from "@/lib/booking-emails";
import { EMAIL_FROM } from "@/lib/email";
import { renderTemplate } from "@/lib/email/resolve";
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
      .select('id, date, title, seating_required, is_bookable')
      .eq('id', formData.event_id)
      .single();

    if (eventLookupError || !eventRow) throw new Error("Failed to resolve event context.");

    const eventId = eventRow.id;
    const quizDate = eventRow.date as string;
    const quizTitle = (eventRow.title as string | null)?.trim() || "Quiz Night";

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
      await sendBookingEmail(supabase, newBooking.id, formData.email, formData.name, quizDate, quizTitle, formData.team_name, formData.team_size, finalStatus);
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  booking_id: number,
  email: string,
  name: string,
  quiz_date: string,
  quiz_title: string,
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
  const partySize = `${team_size} ${team_size === 1 ? "Person" : "People"}`;

  const slots = await renderTemplate(
    supabase,
    status === "confirmed" ? "booking.quiz.confirmed" : "booking.quiz.waitlisted",
    {
      customerName: name,
      eventTitle: quiz_title,
      eventDate: formatEventDate(quiz_date),
      groupName: team_name,
      groupSize: partySize,
      bookingId: String(booking_id),
    }
  );
  if (!slots) return;

  const { subject, html } = buildBookingConfirmedEmail({
    slots,
    rows: [
      { label: "📅 Date", value: formatEventDate(quiz_date) },
      { label: "🍺 Team", value: team_name },
      { label: "👥 Size", value: partySize },
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