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
  status: "confirmed" | "rejected",
  adminNotes?: string
) {
  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)
    .select("booker_name, email")
    .single();

  if (error || !record) throw new Error("Failed to update status.");

  await sendOutcomeEmail(record.booker_name, record.email, status, adminNotes);

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/dashboard");
}

async function sendOutcomeEmail(
  name: string,
  email: string,
  status: "confirmed" | "rejected",
  notes?: string | null
) {
  const isConfirmed = status === "confirmed";
  const subject = isConfirmed
    ? "Your Band Application Has Been Approved! 🎸"
    : "Update on Your Band Application — Don Fenticas";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hey ${name}!</h2>
        <p>${isConfirmed
          ? "Great news! Your application to perform at Don Fenticas has been <strong>approved</strong>. We'll be in touch with the next steps."
          : "Thank you for applying to perform at Don Fenticas. After reviewing your application, we're unable to proceed at this time."}</p>
        ${notes ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Note from our team:</strong> ${notes}</p></div>` : ""}
        <p style="font-size:12px;color:#6b7280;">If you have questions, reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM, to: email, subject, html });
}
