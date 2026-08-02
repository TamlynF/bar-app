"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bookingsdonfenticas.co.uk";

export type EnquiryData = {
  full_name: string;
  email: string;
  phone_no: string | null;
  subject: string | null;
  message: string;
};

export async function createEnquiry(formData: FormData) {
  const data: EnquiryData = {
    full_name: (formData.get("full_name") as string)?.trim() || "",
    email: (formData.get("email") as string)?.trim() || "",
    phone_no: (formData.get("phone_no") as string)?.trim() || null,
    subject: (formData.get("subject") as string)?.trim() || null,
    message: (formData.get("message") as string)?.trim() || "",
  };

  if (!data.full_name || !data.email || !data.message) {
    return { error: "Please fill in your name, email and message." };
  }
  if (data.message.length > 4000) {
    return { error: "Message is too long (4000 characters max)." };
  }

  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from("enquiries")
    .insert(data)
    .select("id")
    .single();

  if (error || !record) {
    console.error("Error creating enquiry:", error);
    return { error: "Something went wrong. Please try again." };
  }

  await Promise.allSettled([
    sendEnquirerEmail(data.full_name, data.email),
    sendAdminEmail(data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendEnquirerEmail(name: string, email: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hi ${name}!</h2>
        <p>Thanks for getting in touch with <strong>Don Fenticas</strong>. We've received your message and one of the team will get back to you shortly.</p>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#6b7280;">🎸 Don Fenticas - Grassroots Live Music & Nightlife, Hinckley</p>
        </div>
        <p style="font-size:12px;color:#6b7280;">If it's urgent, you can reply directly to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "We've got your message - Don Fenticas",
    html,
  });
}

async function sendAdminEmail(data: EnquiryData, id: string) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">New Enquiry</h2>
        <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
          <p><strong>Name:</strong> ${data.full_name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone_no || "-"}</p>
          <p><strong>Subject:</strong> ${data.subject || "-"}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;">${data.message}</p>
        </div>
        <p style="font-size:12px;color:#6b7280;">Enquiry ID: ${id}</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Enquiry - ${data.full_name}${data.subject ? `: ${data.subject}` : ""}`,
    html,
  });
}