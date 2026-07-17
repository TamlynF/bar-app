"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planBandEventSync, type BandStatus as BandStatusType } from "@/lib/band-event-sync";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { buildRescheduleEmail, buildOfferEmail, buildOutcomeEmail } from "@/lib/band-emails";

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
    /** jsonb — platform → url, blanks already dropped by the caller. */
    social_links?: Record<string, string> | null;
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
 * Flags/unflags a request as a favourite. Unlike `updateBandBookingFields` this
 * deliberately does NOT stamp updated_by/updated_at — a favourite is a bookmark,
 * not an edit to the record, so it stays out of the audit trail.
 */
export async function toggleBandFavorite(id: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("band_booking_requests")
    .update({ is_favorite: value })
    .eq("id", id);

  if (error) throw new Error("Failed to update favourite.");

  revalidatePath("/event-bookings/music-bookings");
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
 * Used when an admin edits the date/time of an already-booked booking. The
 * booking drops back to "offered", its linked event is deactivated, and the band
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
    .update({ ...fields, status: "offered", updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("booker_name, email, group_name, selected_date, selected_start_time, selected_end_time, event_id")
    .single();

  if (error || !record) throw new Error("Failed to update booking.");

  // Back to offered → take the linked event off the schedule until re-booked.
  const plan = planBandEventSync({ status: "offered", selectedDate: record.selected_date, eventId: record.event_id });
  if (plan.action === "deactivate") {
    await supabase.from("events").update({ is_active: false }).eq("id", plan.eventId);
  }

  const emailError = await sendRescheduleEmail(
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

  return { emailError };
}

/**
 * `emailNote` is the message the band reads on this transition. Only a decline
 * keeps it on the record (as the decline reason) — offer/booked messages are
 * written per-send, so they must neither overwrite nor blank out admin_notes.
 */
export async function updateBandStatus(
  id: string,
  status: BandStatus,
  emailNote?: string
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({
      status,
      ...(status === "declined" ? { admin_notes: emailNote || null } : {}),
      updated_by: empId,
      updated_at: new Date().toISOString(),
    })
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
    // Any non-booked status takes the linked event off the schedule.
    await supabase.from("events").update({ is_active: false }).eq("id", plan.eventId);
  }

  // Emails per stage: offered → offer email; booked/declined → the existing
  // outcome templates (mapped onto their old confirmed/cancelled names);
  // new/reviewing → silent.
  let emailError: string | null = null;
  if (status === "offered") {
    emailError = await sendOfferEmail(
      record.booker_name,
      record.email,
      record.group_name,
      record.selected_date,
      record.selected_start_time,
      record.selected_end_time,
      record.payment_amount,
      emailNote
    );
  } else if (status === "booked" || status === "declined") {
    emailError = await sendOutcomeEmail(
      record.booker_name,
      record.email,
      status === "booked" ? "confirmed" : "cancelled",
      record.group_name,
      record.selected_date,
      record.selected_start_time,
      record.selected_end_time,
      emailNote
    );
  }

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");

  return { emailError };
}

async function sendRescheduleEmail(
  name: string,
  email: string,
  groupName: string | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null
): Promise<string | null> {
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
  if (error) {
    console.error("[band reschedule email] Resend failed:", JSON.stringify(error));
    return error.message ?? "Email failed to send.";
  }
  console.log("[band reschedule email] sent:", data?.id, "→", email);
  return null;
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
): Promise<string | null> {
  const e = buildOutcomeEmail({
    name,
    groupName,
    outcome: status,
    date: selectedDate ?? null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    notes,
  });

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
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${e.body[0]}</p>
        ${e.dateLabel ? `
        <div style="background:#fff;border:2px solid #E6DFC8;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Performance Date</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#1F1F1A;">${e.dateLabel}</p>
          ${e.timeLabel ? `<p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#5F624F;">${e.timeLabel}</p>` : ""}
        </div>` : ""}
        ${e.body.slice(1).map((p) => `<p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${p}</p>`).join("")}
        ${e.noteLabel ? `
        <div style="background:#fff;border-left:4px solid #5C4033;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Note from our team</p>
          <p style="margin:0;font-size:14px;color:#1F1F1A;line-height:1.5;">${e.noteLabel}</p>
        </div>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #E6DFC8;text-align:center;">
        <p style="margin:0;font-size:11px;color:#5F624F;">
          Don Fenticas — Unit 1, Regent St, Hinckley LE10 0BB
        </p>
      </div>
    </div>`;

  const { data, error } = await resend.emails.send({ from: FROM, to: email, subject: e.subject, html });
  if (error) {
    console.error("[band outcome email] Resend failed:", JSON.stringify(error));
    return error.message ?? "Email failed to send.";
  }
  console.log("[band outcome email] sent:", data?.id, "→", email);
  return null;
}

async function sendOfferEmail(
  name: string,
  email: string,
  groupName: string | null,
  date: string | null,
  startTime: string | null,
  endTime: string | null,
  paymentAmount: number | null,
  notes?: string | null
): Promise<string | null> {
  const e = buildOfferEmail({
    name,
    groupName,
    date,
    startTime,
    endTime,
    paymentAmount,
    notes,
  });

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
        <p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${e.body[0]}</p>
        <div style="background:#fff;border:2px solid #E6DFC8;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Proposed Slot</p>
          <p style="margin:0;font-size:18px;font-weight:900;color:#1F1F1A;">${e.slotLabel}</p>
          ${e.feeLabel ? `<p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#5F624F;">${e.feeLabel}</p>` : ""}
        </div>
        ${e.noteLabel ? `
        <div style="background:#fff;border-left:4px solid #5C4033;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#5F624F;">Note from our team</p>
          <p style="margin:0;font-size:14px;color:#1F1F1A;line-height:1.5;">${e.noteLabel}</p>
        </div>` : ""}
        ${e.body.slice(1).map((p) => `<p style="margin:0 0 16px;color:#1F1F1A;font-size:15px;line-height:1.6;">${p}</p>`).join("")}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #E6DFC8;text-align:center;">
        <p style="margin:0;font-size:11px;color:#5F624F;">
          Don Fenticas — Unit 1, Regent St, Hinckley LE10 0BB
        </p>
      </div>
    </div>`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: e.subject,
    html,
  });
  if (error) {
    console.error("[band offer email] Resend failed:", JSON.stringify(error));
    return error.message ?? "Email failed to send.";
  }
  console.log("[band offer email] sent:", data?.id, "→", email);
  return null;
}
