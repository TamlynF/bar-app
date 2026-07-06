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

/**
 * Booking-display fields a private-hire linked event inherits from its parent
 * event_types row (is_bookable, booking_config, and the booking-card branding).
 * Keeps the auto-created event's public booking surface in step with the category.
 */
async function eventTypeBookingFields(eventTypeId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_types")
    .select("is_bookable, booking_config, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge")
    .eq("id", eventTypeId)
    .maybeSingle();
  return {
    is_bookable: data?.is_bookable ?? false,
    booking_config: data?.booking_config ?? null,
    booking_card_title: data?.booking_card_title ?? null,
    booking_card_tagline: data?.booking_card_tagline ?? null,
    booking_card_icon: data?.booking_card_icon ?? null,
    booking_card_badge: data?.booking_card_badge ?? null,
  };
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

/** Event types + subtypes available for a private-hire enquiry (behaviour = private). */
export async function getPrivateEventOptions() {
  const supabase = await createClient();
  const [{ data: subs }, { data: allTypes }] = await Promise.all([
    supabase.from("event_subtypes").select("id, name, event_types_id").eq("behavior", "private").order("name"),
    supabase.from("event_types").select("id, name").order("name"),
  ]);
  const subtypes = (subs ?? []) as { id: number; name: string; event_types_id: number }[];
  const typeIds = new Set(subtypes.map((s) => s.event_types_id));
  const types = ((allTypes ?? []) as { id: number; name: string }[]).filter((t) => typeIds.has(t.id));
  return { types, subtypes };
}

/**
 * Persist admin edits to a private-hire enquiry (guests, reason, chosen event
 * sub-type, and the selected date/time). When the enquiry is already confirmed
 * and has a linked event, that event is kept in sync with the new details.
 */
export async function updatePrivateHireFields(
  id: string,
  fields: {
    guest_count?: number;
    reason?: string | null;
    selected_date?: string | null;
    selected_start_time?: string | null;
    selected_end_time?: string | null;
    event_subtypes_id?: number | null;
    admin_notes?: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("private_hire_requests")
    .update({ ...fields, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "full_name, status, event_id, selected_date, selected_start_time, selected_end_time, reason, reason_for_hire, deposit_amount, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id )"
    )
    .single();

  if (error || !record) throw new Error("Failed to save changes.");

  // Keep a confirmed enquiry's linked event aligned with the edited details.
  if ((record.status || "").toLowerCase() === "confirmed" && record.event_id) {
    const sub = unwrapSubtype(
      record.event_subtypes as { id: number; name: string; default_event_title: string | null; event_types_id: number } | { id: number; name: string; default_event_title: string | null; event_types_id: number }[] | null
    );
    const label = sub
      ? privateHireSubtypeLabel(sub, record.reason_for_hire || "Private Hire")
      : record.reason || record.reason_for_hire || "Private Hire";
    const eventUpdate: Record<string, unknown> = {
      title: `${record.full_name} — ${label}`,
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      // Private-hire linked events are always free — deposits are tracked on the request.
      payment_amount: 0,
      updated_by: empId,
      updated_at: new Date().toISOString(),
    };
    if (sub) {
      eventUpdate.event_types_id = sub.event_types_id;
      eventUpdate.event_subtypes_id = sub.id;
      // Keep the public booking surface in step with the category.
      Object.assign(eventUpdate, await eventTypeBookingFields(sub.event_types_id));
    }
    await supabase.from("events").update(eventUpdate).eq("id", record.event_id);
  }

  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
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
    .update({ status, admin_notes: adminNotes || null, updated_by: empId, updated_at: new Date().toISOString() })
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

    const now = new Date().toISOString();
    const eventFields = {
      title: `${record.full_name} — ${label}`,
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      event_types_id: eventTypeId,
      event_subtypes_id: eventSubtypeId,
      // Private-hire linked events are always free — deposits are tracked on the request.
      payment_amount: 0,
      is_active: true,
      // Inherit the public booking surface (bookable + card branding) from the category.
      ...(await eventTypeBookingFields(eventTypeId)),
      updated_by: empId,
      updated_at: now,
    };

    if (plan.action === "update") {
      // Keep the existing linked event in sync — never create a duplicate.
      await supabase.from("events").update(eventFields).eq("id", plan.eventId);
    } else {
      const { data: newEvent } = await supabase
        .from("events")
        .insert({ ...eventFields, created_by: empId, created_at: now })
        .select("id")
        .single();
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
