"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/email";
import { getContactEmail } from "@/lib/company-info";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";

const resend = new Resend(process.env.RESEND_API_KEY);


async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  return emp?.id ?? null;
}

export async function getEnquiries() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching enquiries:", error);
    throw new Error("Failed to fetch enquiries");
  }
  return data ?? [];
}

export async function replyToEnquiry(id: string, replyMessage: string) {
  const trimmed = replyMessage.trim();
  if (!trimmed) throw new Error("Reply message is required.");

  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("enquiries")
    .update({
      status: "responded",
      reply_message: trimmed,
      updated_at: new Date().toISOString(),
      updated_by: empId,
    })
    .eq("id", id)
    .select("full_name, email, subject, message")
    .single();

  if (error || !record) throw new Error("Failed to update enquiry.");

  const slots = await renderTemplate(supabase, "enquiry.reply", {
    customerName: record.full_name,
    enquirySubject: record.subject || "Your enquiry",
  });

  if (slots) {
    /* The reply itself is typed by staff at send time, and the original message
       came from the public web - both are generated content, not template copy,
       so both are escaped. */
    const bodyHtml = `<p style="white-space:pre-wrap;">${escapeHtml(trimmed)}</p>`;
    const panelHtml =
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:bold;">Your original message:</p>` +
      `<p style="margin:0;font-size:13px;color:#6b7280;white-space:pre-wrap;">${escapeHtml(record.message)}</p>`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: record.email,
      replyTo: await getContactEmail(),
      subject: slots.subject,
      html: plainLayout({ slots, bodyHtml, panelHtml }),
    });
  }

  revalidatePath("/requests/enquiries");
  revalidatePath("/dashboard");
}

export async function closeEnquiry(id: string, adminNotes?: string) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "closed",
      admin_notes: adminNotes?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: empId,
    })
    .eq("id", id);

  if (error) throw new Error("Failed to close enquiry.");

  revalidatePath("/requests/enquiries");
  revalidatePath("/dashboard");
}