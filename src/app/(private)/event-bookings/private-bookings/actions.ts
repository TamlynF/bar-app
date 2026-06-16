"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export async function getPrivateHireById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("private_hire_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Private hire request not found");
  return data;
}

export async function updatePrivateHireStatus(
  id: string,
  status: "confirmed" | "rejected",
  adminNotes?: string
) {
  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from("private_hire_requests")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)
    .select("full_name, email, reason_for_hire, reason, selected_date, selected_start_time, selected_end_time, deposit_amount")
    .single();

  if (error || !record) {
    console.log("Supabase error:", error);
    throw new Error("Failed to update status.");
  }

  // When confirmed, create an event with the matching private event type
  if (status === "confirmed" && record.selected_date) {
    const reason = record.reason?.toLowerCase() || "other";

    const { eventTypeId, eventSubtypeId } = await resolveEventSubtype(supabase, "private", reason, "private");

    const { data: newEvent } = await supabase.from("events").insert({
      title: `${record.full_name} — ${record.reason || "Private Hire"}`,
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      event_types_id: eventTypeId,
      event_subtypes_id: eventSubtypeId,
      payment_amount: record.deposit_amount,
      is_active: true,
    }).select("id").single();

    if (newEvent) {
      await supabase
        .from("private_hire_requests")
        .update({ event_id: newEvent.id })
        .eq("id", id);
    }
  }

  await sendOutcomeEmail(record.full_name, record.email, status, adminNotes);

  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
}

async function sendOutcomeEmail(
  name: string,
  email: string,
  status: "confirmed" | "rejected",
  notes?: string | null
) {
  const isConfirmed = status === "confirmed";
  const subject = isConfirmed
    ? "Your Private Hire Enquiry Has Been Confirmed! 🎉"
    : "Update on Your Private Hire Enquiry — Don Fenticas";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hi ${name}!</h2>
        <p>${isConfirmed
          ? "We're delighted to confirm your private hire booking at <strong>Don Fenticas</strong>. Our team will be in touch shortly with the next steps."
          : "Thank you for your private hire enquiry. Unfortunately we're unable to accommodate your request at this time."}</p>
        ${notes ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Note from our team:</strong> ${notes}</p></div>` : ""}
        <p style="font-size:12px;color:#6b7280;">If you have questions, please reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM, to: email, subject, html });
}
