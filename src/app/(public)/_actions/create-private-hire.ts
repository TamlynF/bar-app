"use server";

import { createClient } from "@/lib/supabase/server";
import { upsertContactByEmail } from "@/lib/music-acts";
import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { sendCorrespondenceEmail, resendTemplateAttachments } from "@/lib/email/correspondence-data";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";
import { getCompanyInfo } from "@/lib/company-info";
import { describeOpenSessionClash, openSessionClash, toMinutes } from "@/lib/opening-hours";
import { requestPageUrl } from "@/lib/private-hire-flow";
import { isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { privateHireSubtypeLabel } from "@/lib/private-hire-subtype";

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
  phone_no: string;
  guest_count: number;
  preferred_date?: string;
  preferred_start_time?: string;
  preferred_end_time?: string;
  event_subtypes_id: number;
  additional_requirements?: string;
}

export async function createPrivateHire(data: PrivateHireData) {
  if (!data.phone_no?.trim()) throw new Error("Please enter your phone number.");
  if (!isValidPhone(data.phone_no)) throw new Error(PHONE_ERROR);
  const start = toMinutes(data.preferred_start_time);
  const end = toMinutes(data.preferred_end_time);
  if (data.preferred_date && start != null && end != null) {
    const companyInfo = await getCompanyInfo();
    const clash = openSessionClash(companyInfo?.opening_hours, data.preferred_date, start, end);
    if (clash) throw new Error(describeOpenSessionClash(clash));
  }

  const supabase = await createClient();

  const { data: subtype } = await supabase
    .from("event_subtypes")
    .select("id, name, default_event_title")
    .eq("id", data.event_subtypes_id)
    .eq("behavior", "private")
    .eq("show_on_enquiry_form", true)
    .maybeSingle();
  if (!subtype) throw new Error("Please select a reason for hire.");

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
        event_subtypes_id: subtype.id,
        additional_requirements: data.additional_requirements || null,
        status: "new",
      },
    ])
    .select("id")
    .single();

  if (error || !record) {
    console.error("Private hire insert error:", error);
    throw new Error("Failed to submit your enquiry. Please try again.");
  }

  await Promise.allSettled([
    sendBookerEmail(supabase, record.id, data.full_name, data.email),
    sendAdminEmail(supabase, data, privateHireSubtypeLabel(subtype, "Private Hire"), record.id),
  ]);

  return { success: true, id: record.id };
}

async function sendBookerEmail(supabase: ServerClient, requestId: string, name: string, email: string) {
  const slots = await renderTemplate(supabase, "private_hire.enquiry.customer", {
    customerName: name,
  });
  if (!slots) return;

  await sendCorrespondenceEmail({
    resend,
    links: { privateHireRequestId: requestId },
    to: email,
    subject: slots.subject,
    templateSlots: slots,
    html: plainLayout({ slots, ctaUrl: requestPageUrl(requestId) }),
    kind: "enquiry",
  });
}

async function sendAdminEmail(supabase: ServerClient, data: PrivateHireData, reasonForHire: string, id: string) {
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
    `<p><strong>Reason for Hire:</strong> ${escapeHtml(reasonForHire)}</p>`,
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
    ...(await resendTemplateAttachments(slots)),
  });
}
