"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";
const REPLY_TO = "admin@bookingsdonfenticas.co.uk";

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

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">Hi ${record.full_name}!</h2>
        <p style="white-space:pre-wrap;">${trimmed}</p>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:bold;">Your original message:</p>
          <p style="margin:0;font-size:13px;color:#6b7280;white-space:pre-wrap;">${record.message}</p>
        </div>
        <p style="font-size:12px;color:#6b7280;">Reply to this email to continue the conversation.</p>
      </div>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to: record.email,
    replyTo: REPLY_TO,
    subject: `Re: ${record.subject || "Your enquiry"} — Don Fenticas`,
    html,
  });

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