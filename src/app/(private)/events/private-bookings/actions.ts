"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

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
    .select("full_name, email")
    .single();

  if (error || !record) throw new Error("Failed to update status.");

  await sendOutcomeEmail(record.full_name, record.email, status, adminNotes);

  revalidatePath("/events/private-bookings");
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
