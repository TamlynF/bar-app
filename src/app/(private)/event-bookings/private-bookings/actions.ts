"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planPrivateEventSync } from "@/lib/private-event-sync";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { buildPrivateHireOutcomeEmail } from "@/lib/private-hire-emails";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
}

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

export async function getClashingEvents(
  date: string,
  startTime: string | null,
  endTime: string | null,
  excludeEventId?: number | null
): Promise<ClashEvent[]> {
  if (!date) return [];
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("id, title, start_time, end_time")
    .eq("date", date)
    .eq("is_active", true);
  if (excludeEventId != null) query = query.neq("id", excludeEventId);

  const { data } = await query;
  return findEventClashes({ start: startTime, end: endTime }, (data ?? []) as ClashEventInput[]);
}

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
      payment_amount: 0,
      updated_by: empId,
      updated_at: new Date().toISOString(),
    };
    if (sub) {
      eventUpdate.event_types_id = sub.event_types_id;
      eventUpdate.event_subtypes_id = sub.id;
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

  const plan = planPrivateEventSync({
    status,
    selectedDate: record.selected_date,
    eventId: record.event_id,
  });

  if (plan.action === "insert" || plan.action === "update") {
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
      payment_amount: 0,
      is_active: true,
      ...(await eventTypeBookingFields(eventTypeId)),
      updated_by: empId,
      updated_at: now,
    };

    if (plan.action === "update") {
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
  const e = buildPrivateHireOutcomeEmail({ name, outcome: status, notes });

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
      <div style="background:#fff;padding:40px;border-radius:8px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#111827;">${e.greeting}</h2>
        ${e.body.map((p) => `<p>${p}</p>`).join("")}
        ${e.noteLabel ? `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;"><p style="margin:0;"><strong>Note from our team:</strong> ${e.noteLabel}</p></div>` : ""}
        <p style="font-size:12px;color:#6b7280;">If you have questions, please reply to this email.</p>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM, to: email, subject: e.subject, html });
}
