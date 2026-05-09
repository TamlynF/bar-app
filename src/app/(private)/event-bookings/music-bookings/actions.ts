"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export async function getBandBookingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("band_booking_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Band booking not found");
  return data;
}

export async function updateBandStatus(
  id: string,
  status: "approved" | "rejected",
  adminNotes?: string
) {
  const supabase = await createClient();
  console.log("Updating band status:", { id, status, adminNotes });
  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)
    .select("booker_name, email, type, group_name, selected_date, selected_start_time, selected_end_time, payment_amount")
    .single();

  if (error || !record) {
    console.log("Supabase error:", error);
    throw new Error("Failed to update status.");
  }

  // When approved, create an event with the matching music event type
  if (status === "approved" && record.selected_date) {
    const bandSubType = record.type?.toLowerCase() ?? "";

    // Look up the event_types row where type='music' and sub_type matches
    let { data: eventType } = await supabase
      .from("event_types")
      .select("id")
      .ilike("type", "music")
      .ilike("sub_type", bandSubType)
      .single();

    if (!eventType) {
      const { data: created } = await supabase
        .from("event_types")
        .insert({ type: "music", sub_type: bandSubType || "other" })
        .select("id")
        .single();
      eventType = created;
    }

    if (eventType) {
      const { data: newEvent } = await supabase.from("events").insert({
        title: record.group_name || record.booker_name,
        date: record.selected_date,
        start_time: record.selected_start_time,
        end_time: record.selected_end_time,
        event_types_id: eventType.id,
        payment_amount: record.payment_amount,
        is_active: true,
      }).select("id").single();

      if (newEvent) {
        await supabase
          .from("band_booking_requests")
          .update({ event_id: newEvent.id })
          .eq("id", id);
      }
    }
  }

  await sendOutcomeEmail(record.booker_name, record.email, status, adminNotes);

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
}

async function sendOutcomeEmail(
  name: string,
  email: string,
  status: "approved" | "rejected",
  notes?: string | null
) {
  const isApproved = status === "approved";
  const subject = isApproved
    ? "Your Band Application Has Been Approved! 🎸"
    : "Update on Your Band Application — Don Fenticas";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hey ${name}!</h2>
        <p>${isApproved
          ? "Great news! Your application to perform at Don Fenticas has been <strong>approved</strong>. We'll be in touch with the next steps."
          : "Thank you for applying to perform at Don Fenticas. After reviewing your application, we're unable to proceed at this time."}</p>
        ${notes ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Note from our team:</strong> ${notes}</p></div>` : ""}
        <p style="font-size:12px;color:#6b7280;">If you have questions, reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM, to: email, subject, html });
}
