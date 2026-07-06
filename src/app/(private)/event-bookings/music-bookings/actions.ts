"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planBandEventSync, type BandStatus as BandStatusType } from "@/lib/band-event-sync";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { buildRescheduleEmail } from "@/lib/band-emails";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export type BandStatus = BandStatusType;

/** Resolve the employee id of the signed-in admin, for created_by/updated_by stamps. */
async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
}

export async function getBandBookingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("band_booking_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Band booking not found");
  return data;
}

export async function updateBandBookingFields(
  id: string,
  fields: {
    group_name?: string | null;
    type?: string | null;
    genre?: string | null;
    booker_name?: string;
    email?: string;
    phone_no?: string | null;
    notes?: string | null;
    band_notes?: string | null;
    selected_date?: string | null;
    selected_start_time?: string | null;
    selected_end_time?: string | null;
    admin_notes?: string | null;
    payment_amount?: number | null;
    paid_amount?: number | null;
    payment_status?: string | null;
    bank_account_no?: string | null;
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_payment_ref?: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { error } = await supabase
    .from("band_booking_requests")
    .update({ ...fields, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Failed to save changes.");

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
}

/**
 * Returns the active events on `date` whose time window overlaps [startTime, endTime).
 * `excludeEventId` skips the booking's own linked event so it never clashes with itself.
 */
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

/**
 * Used when an admin edits the date/time of an already-confirmed booking. The
 * booking drops back to "pending", its linked event is deactivated, and the band
 * is emailed to re-confirm the new slot.
 */
export async function rescheduleConfirmedBooking(
  id: string,
  fields: {
    selected_date: string | null;
    selected_start_time: string | null;
    selected_end_time: string | null;
    admin_notes?: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ ...fields, status: "pending", updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("booker_name, email, group_name, selected_date, selected_start_time, selected_end_time, event_id")
    .single();

  if (error || !record) throw new Error("Failed to update booking.");

  // Back to pending → take the linked event off the schedule.
  const plan = planBandEventSync({ status: "pending", selectedDate: record.selected_date, eventId: record.event_id });
  if (plan.action === "deactivate") {
    await supabase.from("events").update({ is_active: false }).eq("id", plan.eventId);
  }

  await sendRescheduleEmail(
    record.booker_name,
    record.email,
    record.group_name,
    record.selected_date,
    record.selected_start_time,
    record.selected_end_time
  );

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");
}

export async function updateBandStatus(
  id: string,
  status: BandStatus,
  adminNotes?: string
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ status, admin_notes: adminNotes || null, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "booker_name, email, type, genre, group_name, selected_date, selected_start_time, selected_end_time, payment_amount, event_id"
    )
    .single();

  if (error || !record) {
    throw new Error("Failed to update status.");
  }

  // Decide how this status change affects the booking's linked `events` row.
  const plan = planBandEventSync({
    status,
    selectedDate: record.selected_date,
    eventId: record.event_id,
  });

  if (plan.action === "insert" || plan.action === "update") {
    const bandSubType = record.type?.toLowerCase() || "other";

    // Resolve the music event type + subtype, creating both if missing
    const { eventTypeId, eventSubtypeId } = await resolveEventSubtype(supabase, "music", bandSubType, "music_act");

    // Inherit the booking config / card branding from the owning event type so the
    // linked event matches the category. Band-linked events never charge, so
    // payment_amount is forced to 0.
    const { data: et } = await supabase
      .from("event_types")
      .select("is_bookable, booking_config, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge")
      .eq("id", eventTypeId)
      .single();

    const eventFields = {
      title: record.group_name || record.booker_name,
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      event_types_id: eventTypeId,
      event_subtypes_id: eventSubtypeId,
      payment_amount: 0,
      is_active: true,
      is_bookable: et?.is_bookable ?? false,
      booking_config: et?.booking_config ?? {},
      booking_card_title: et?.booking_card_title ?? null,
      booking_card_tagline: et?.booking_card_tagline ?? null,
      booking_card_icon: et?.booking_card_icon ?? null,
      booking_card_badge: et?.booking_card_badge ?? null,
    };

    if (plan.action === "update") {
      // Keep the existing linked event in sync with the (possibly changed) date/time.
      await supabase
        .from("events")
        .update({ ...eventFields, updated_by: empId, updated_at: new Date().toISOString() })
        .eq("id", plan.eventId);
    } else {
      const { data: newEvent } = await supabase
        .from("events")
        .insert({ ...eventFields, created_by: empId, updated_by: empId })
        .select("id")
        .single();

      if (newEvent) {
        await supabase
          .from("band_booking_requests")
          .update({ event_id: newEvent.id, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
  } else if (plan.action === "deactivate") {
    // Cancelling a confirmed booking takes its linked event off the schedule.
    await supabase.from("events").update({ is_active: false }).eq("id", plan.eventId);
  }

  // Send outcome email for confirmed or cancelled
  if (status === "confirmed" || status === "cancelled") {
    await sendOutcomeEmail(
      record.booker_name,
      record.email,
      status,
      record.group_name,
      record.selected_date,
      record.selected_start_time,
      record.selected_end_time,
      adminNotes
    );
  }

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");
}

function formatTime12(t?: string | null): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatDateLong(d?: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function sendRescheduleEmail(
  name: string,
  email: string,
  groupName: string | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null
) {
  const e = buildRescheduleEmail({ name, groupName, date, startTime, endTime });

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#F7F4EA;border-radius:16px;overflow:hidden;">
      <div style="background:#5C4033;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#FDCC4B;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;">
          ${e.heading}
        </h1>
        ${groupName ? `<p style="margin:8px 0 0;color:#E6DFC8;font-size:14px;font-weight:700;">${groupName}</p>` : ""}
      </div>
      <div style="padding:32px 24px;">
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${e.greeting}</p>
        ${e.body.map((p) => `<p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${p}</p>`).join("")}
        ${e.dateLabel ? `
        <div style="background:#fff;border:2px solid #E6DFC8;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">New Performance Slot</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#1F1F1A;">${e.dateLabel}</p>
          ${e.timeLabel ? `<p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#5F624F;">${e.timeLabel}</p>` : ""}
        </div>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #E6DFC8;text-align:center;">
        <p style="margin:0;font-size:11px;color:#5F624F;">
          Don Fenticas — Unit 1, Regent St, Hinckley LE10 0BB
        </p>
      </div>
    </div>`;

  const { data, error } = await resend.emails.send({ from: FROM, to: email, subject: e.subject, html });
  if (error) console.error("[band reschedule email] Resend failed:", JSON.stringify(error));
  else console.log("[band reschedule email] sent:", data?.id, "→", email);
}

async function sendOutcomeEmail(
  name: string,
  email: string,
  status: "confirmed" | "cancelled",
  groupName?: string | null,
  selectedDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  notes?: string | null
) {
  const isConfirmed = status === "confirmed";
  const subject = isConfirmed
    ? "Your Performance at Don Fenticas is Confirmed!"
    : "Update on Your Application — Don Fenticas";

  const dateStr = formatDateLong(selectedDate);
  const timeStr = [formatTime12(startTime), formatTime12(endTime)]
    .filter(Boolean)
    .join(" – ");

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#F7F4EA;border-radius:16px;overflow:hidden;">
      <div style="background:#5C4033;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#FDCC4B;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;">
          ${isConfirmed ? "You're Confirmed!" : "Application Update"}
        </h1>
        ${groupName ? `<p style="margin:8px 0 0;color:#E6DFC8;font-size:14px;font-weight:700;">${groupName}</p>` : ""}
      </div>
      <div style="padding:32px 24px;">
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">
          Hey ${name},
        </p>
        ${isConfirmed ? `
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">
          Great news! Your application to perform at <strong>Don Fenticas</strong> has been <strong>confirmed</strong>.
        </p>
        ${dateStr ? `
        <div style="background:#fff;border:2px solid #E6DFC8;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Performance Date</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#1F1F1A;">${dateStr}</p>
          ${timeStr ? `<p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#5F624F;">${timeStr}</p>` : ""}
        </div>` : ""}
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">
          We'll be in touch closer to the date with any further details. If you have any questions in the meantime, just reply to this email.
        </p>
        ` : `
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">
          Thank you for applying to perform at <strong>Don Fenticas</strong>. After reviewing your application, we're unable to proceed at this time.
        </p>
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">
          We appreciate your interest and encourage you to apply again in the future.
        </p>
        `}
        ${notes ? `
        <div style="background:#fff;border-left:4px solid #5C4033;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Note from our team</p>
          <p style="margin:0;font-size:14px;color:#1F1F1A;line-height:1.5;">${notes}</p>
        </div>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #E6DFC8;text-align:center;">
        <p style="margin:0;font-size:11px;color:#5F624F;">
          Don Fenticas — Unit 1, Regent St, Hinckley LE10 0BB
        </p>
      </div>
    </div>`;

  const { data, error } = await resend.emails.send({ from: FROM, to: email, subject, html });
  if (error) console.error("[band outcome email] Resend failed:", JSON.stringify(error));
  else console.log("[band outcome email] sent:", data?.id, "→", email);
}
