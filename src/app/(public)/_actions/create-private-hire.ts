"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertContactByEmail } from "@/lib/music-acts";
import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";

const resend = new Resend(process.env.RESEND_API_KEY);

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const appUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";


export interface PrivateHireData {
  full_name: string;
  email: string;
  phone_no?: string;
  guest_count: number;
  preferred_date?: string;
  preferred_start_time?: string;
  preferred_end_time?: string;
  event_subtypes_id: number | null;
  reason_for_hire: string;
  additional_requirements?: string;
}

export async function createPrivateHire(data: PrivateHireData) {
  const supabase = await createClient();

  // Ties the enquiry to a person rather than to whatever address they typed,
  // and creates the contact when this is their first dealing with the venue.
  const contactId = await upsertContactByEmail(supabase, {
    booker_name: data.full_name,
    email: data.email,
    phone_no: data.phone_no,
  });

  const { data: record, error } = await supabase
    .from("private_hire_requests")
    .insert([
      {
        full_name: data.full_name,
        email: data.email,
        contact_id: contactId,
        phone_no: data.phone_no || null,
        guest_count: data.guest_count,
        preferred_date: data.preferred_date || null,
        preferred_start_time: data.preferred_start_time || null,
        preferred_end_time: data.preferred_end_time || null,
        event_subtypes_id: data.event_subtypes_id,
        reason_for_hire: data.reason_for_hire,
        additional_requirements: data.additional_requirements || null,
        status: "pending",
      },
    ])
    .select("id")
    .single();

  if (error || !record) {
    console.error("Private hire insert error:", error);
    throw new Error("Failed to submit your enquiry. Please try again.");
  }

  await Promise.allSettled([
    sendBookerEmail(supabase, data.full_name, data.email),
    sendAdminEmail(supabase, data, record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(supabase: ServerClient, name: string, email: string) {
  const slots = await renderTemplate(supabase, "private_hire.enquiry.customer", {
    customerName: name,
  });
  if (!slots) return;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: slots.subject,
    html: plainLayout({ slots }),
  });
}

async function sendAdminEmail(supabase: ServerClient, data: PrivateHireData, id: string) {
  const slots = await renderTemplate(supabase, "private_hire.enquiry.admin", {
    customerName: data.full_name,
  });
  if (!slots) return;

  const requestUrl = `${appUrl}/event-bookings/private-bookings?open=${id}`;

  /* Generated from whatever the enquiry form collected, and every value came
     from the public web, so all of it is escaped. */
  const panelHtml = [
    `<p><strong>Name:</strong> ${escapeHtml(data.full_name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>`,
    `<p><strong>Phone:</strong> ${escapeHtml(data.phone_no || "-")}</p>`,
    `<p><strong>Guests:</strong> ${escapeHtml(String(data.guest_count))}</p>`,
    `<p><strong>Preferred Date:</strong> ${escapeHtml(data.preferred_date || "Not specified")}</p>`,
    `<p><strong>Start Time:</strong> ${escapeHtml(data.preferred_start_time || "Not specified")}</p>`,
    `<p><strong>End Time:</strong> ${escapeHtml(data.preferred_end_time || "Not specified")}</p>`,
    `<p><strong>Reason for Hire:</strong> ${escapeHtml(data.reason_for_hire)}</p>`,
    data.additional_requirements
      ? `<p><strong>Additional Requirements:</strong> ${escapeHtml(data.additional_requirements)}</p>`
      : "",
  ].join("");

  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: slots.subject,
    html: plainLayout({
      slots,
      panelHtml,
      ctaUrl: requestUrl,
      trailer: `Enquiry ID: ${escapeHtml(id)}`,
    }),
  });
}
