"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = "admin@bookingsdonfenticas.co.uk";
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export interface PrivateHireData {
  full_name: string;
  email: string;
  phone_no?: string;
  guest_count: number;
  preferred_date?: string;
  preferred_start_time?: string;
  preferred_end_time?: string;
  reason_for_hire: string;
  additional_requirements?: string;
}

export async function createPrivateHire(data: PrivateHireData) {
  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from("private_hire_requests")
    .insert([
      {
        full_name: data.full_name,
        email: data.email,
        phone_no: data.phone_no || null,
        guest_count: data.guest_count,
        preferred_date: data.preferred_date || null,
        preferred_start_time: data.preferred_start_time || null,
        preferred_end_time: data.preferred_end_time || null,
        reason_for_hire: data.reason_for_hire,
        additional_requirements: data.additional_requirements || null,
        status: "pending_review",
      },
    ])
    .select("id")
    .single();

  if (error || !record) {
    console.error("Private hire insert error:", error);
    throw new Error("Failed to submit your enquiry. Please try again.");
  }

  await Promise.allSettled([
    sendBookerEmail(data.full_name, data.email),
    sendAdminEmail(data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(name: string, email: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hi ${name}!</h2>
        <p>Thank you for your private hire enquiry at <strong>Don Fenticas</strong>. We've received your request and our team will be in touch shortly to discuss availability and details.</p>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#6b7280;">🏠 Don Fenticas — Private Hire Enquiries</p>
        </div>
        <p style="font-size:12px;color:#6b7280;">If you have any urgent questions, please reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Private Hire Enquiry Received — Don Fenticas",
    html,
  });
}

async function sendAdminEmail(data: PrivateHireData, id: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">New Private Hire Enquiry</h2>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p><strong>Name:</strong> ${data.full_name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone_no || "—"}</p>
          <p><strong>Guests:</strong> ${data.guest_count}</p>
          <p><strong>Preferred Date:</strong> ${data.preferred_date || "Not specified"}</p>
          <p><strong>Start Time:</strong> ${data.preferred_start_time || "Not specified"}</p>
          <p><strong>End Time:</strong> ${data.preferred_end_time || "Not specified"}</p>
          <p><strong>Reason for Hire:</strong> ${data.reason_for_hire}</p>
          ${data.additional_requirements ? `<p><strong>Additional Requirements:</strong> ${data.additional_requirements}</p>` : ""}
        </div>
        <p style="font-size:12px;color:#6b7280;">Enquiry ID: ${id}</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Private Hire Enquiry — ${data.full_name}`,
    html,
  });
}
