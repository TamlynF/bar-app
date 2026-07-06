"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planPrivateEventSync } from "@/lib/private-event-sync";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

/** Resolve the employee id of the signed-in admin, for created_by/updated_by stamps. */
async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
}

export async function getPrivateHireById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("private_hire_requests")
    .select("*, event_subtypes:event_subtypes_id ( name, default_event_title )")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Private hire request not found");
  return data;
}

export async function updatePrivateHireStatus(
  id: string,
  status: "confirmed" | "cancelled",
  adminNotes?: string
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("private_hire_requests")
    .update({ status, admin_notes: adminNotes || null, updated_by: empId })
    .eq("id", id)
    .select("full_name, email, reason_for_hire, reason, selected_date, selected_start_time, selected_end_time, deposit_amount, event_id, event_subtypes_id, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id )")
    .single();

  if (error || !record) {
    console.log("Supabase error:", error);
    throw new Error("Failed to update status.");
  }

  // Decide how this status change affects the request's linked `events` row.
  const plan = planPrivateEventSync({
    status,
    selectedDate: record.selected_date,
    eventId: record.event_id,
  });

  if (plan.action === "insert" || plan.action === "update") {
    // Prefer the linked private subtype; fall back to lazily resolving by the
    // legacy `reason` for rows created before event_subtypes_id existed.
    const sub = unwrapSubtype(
      record.event_subtypes as { id: number; name: string; default_event_title: string | null; event_types_id: number } | { id: number; name: string; default_event_title: string | null; event_types_id: number }[] | null
    );

    let eventTypeId: number;
    let eventSubtypeId: number;
    let label: string;
    if (sub) {
      eventTypeId = sub.event_types_id;
      eventSubtypeId = sub.id;
      label = privateHireSubtypeLabel(sub, record.reason_for_hire || "Private Hire");
    } else {
      const reason = record.reason?.toLowerCase() || record.reason_for_hire?.toLowerCase() || "other";
      ({ eventTypeId, eventSubtypeId } = await resolveEventSubtype(supabase, "private", reason, "private"));
      label = record.reason || record.reason_for_hire || "Private Hire";
    }

    const eventFields = {
      title: `${record.full_name} — ${label}`,
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      event_types_id: eventTypeId,
      event_subtypes_id: eventSubtypeId,
      payment_amount: record.deposit_amount,
      is_active: true,
    };

    if (plan.action === "update") {
      // Keep the existing linked event in sync — never create a duplicate.
      await supabase.from("events").update(eventFields).eq("id", plan.eventId);
    } else {
      const { data: newEvent } = await supabase.from("events").insert(eventFields).select("id").single();
      if (newEvent) {
        await supabase
          .from("private_hire_requests")
          .update({ event_id: newEvent.id })
          .eq("id", id);
      }
    }
  } else if (plan.action === "deactivate") {
    // Canceling takes the linked event off the schedule.
    await supabase.from("events").update({ is_active: false }).eq("id", plan.eventId);
  }

  await sendOutcomeEmail(record.full_name, record.email, status, adminNotes);

  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
}

async function sendOutcomeEmail(
  name: string,
  email: string,
  status: "confirmed" | "cancelled",
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
