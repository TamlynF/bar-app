"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";

const resend = new Resend(process.env.RESEND_API_KEY);


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
    sendEnquirerEmail(supabase, data.full_name, data.email),
    sendAdminEmail(supabase, data, record.id),
  ]);

  return { success: true, id: record.id };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function sendEnquirerEmail(supabase: ServerClient, name: string, email: string) {
  const slots = await renderTemplate(supabase, "enquiry.received.customer", {
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

async function sendAdminEmail(supabase: ServerClient, data: EnquiryData, id: string) {
  const slots = await renderTemplate(supabase, "enquiry.received.admin", {
    customerName: data.full_name,
    enquirySubject: data.subject ?? "-",
    subjectSuffix: data.subject ? `: ${data.subject}` : "",
  });
  if (!slots) return;

  /* The field dump is generated rather than authored: it has to follow whatever
     the enquiry form collects, and every value here came from the public web. */
  const panelHtml = [
    `<p><strong>Name:</strong> ${escapeHtml(data.full_name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(data.email)}</p>`,
    `<p><strong>Phone:</strong> ${escapeHtml(data.phone_no || "-")}</p>`,
    `<p><strong>Subject:</strong> ${escapeHtml(data.subject || "-")}</p>`,
    `<p><strong>Message:</strong></p>`,
    `<p style="white-space:pre-wrap;">${escapeHtml(data.message)}</p>`,
  ].join("");

  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: slots.subject,
    html: plainLayout({ slots, panelHtml, trailer: `Enquiry ID: ${escapeHtml(id)}` }),
  });
}