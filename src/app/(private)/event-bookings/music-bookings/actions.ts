"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planBandEventSync, type BandStatus as BandStatusType } from "@/lib/band-event-sync";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { eventSlotIsComplete } from "@/lib/event-active";
import { buildRescheduleEmail, buildOfferEmail, buildOutcomeEmail } from "@/lib/band-emails";
import {
  upsertContactByEmail,
  upsertMusicActFromBand,
  syncMusicActFields,
} from "@/lib/music-acts";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export type BandStatus = BandStatusType;

async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
}

function eventTitleFor(record: { group_name: string | null; booker_name: string }): string {
  return record.group_name || record.booker_name;
}

async function updateLinkedEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: number,
  fields: Record<string, unknown>,
  empId: number | null
) {
  await supabase
    .from("events")
    .update({ ...fields, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", eventId);
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
    video_urls?: string[] | null;
    video_descriptions?: string[] | null;
    social_links?: Record<string, string> | null;
    spotify_url?: string | null;
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
  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ ...fields, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("group_name, booker_name, email, phone_no, event_id, music_acts_id")
    .single();

  if (error || !record) throw new Error("Failed to save changes.");

  const renamed = "group_name" in fields || "booker_name" in fields;
  if (record.event_id && renamed) {
    await updateLinkedEvent(supabase, record.event_id, { title: eventTitleFor(record) }, empId);
  }

  if ("group_name" in fields) {
    const shared = {
      group_name: fields.group_name ?? record.group_name ?? "",
      type: fields.type,
      genre: fields.genre,
      spotify_url: fields.spotify_url,
      social_links: fields.social_links,
      video_urls: fields.video_urls,
      video_descriptions: fields.video_descriptions,
      bank_account_no: fields.bank_account_no,
      bank_account_name: fields.bank_account_name,
      bank_sort_code: fields.bank_sort_code,
      bank_payment_ref: fields.bank_payment_ref,
    };
    let actId = record.music_acts_id as string | null;
    if (!actId) {
      const contactId = await upsertContactByEmail(
        supabase,
        {
          booker_name: fields.booker_name ?? record.booker_name,
          email: fields.email ?? record.email,
          phone_no: fields.phone_no ?? record.phone_no,
        },
        empId
      );
      actId = await upsertMusicActFromBand(supabase, { contactId, ...shared }, empId);
      if (actId) {
        await supabase
          .from("band_booking_requests")
          .update({ music_acts_id: actId })
          .eq("id", id);
      }
    }
    if (actId) await syncMusicActFields(supabase, actId, shared, empId);
  }

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");
}

const NOTE_REVALIDATE = ["/event-bookings/music-bookings"] as const;

function revalidateNotes() {
  for (const path of NOTE_REVALIDATE) revalidatePath(path);
}

export async function addBandNote(requestId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { error } = await supabase
    .from("band_booking_notes")
    .insert({ request_id: requestId, body: text, created_by: empId, updated_by: empId });

  if (error) throw new Error("Failed to add the note.");
  revalidateNotes();
}

export async function updateBandNote(noteId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { error } = await supabase
    .from("band_booking_notes")
    .update({ body: text, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) throw new Error("Failed to save the note.");
  revalidateNotes();
}

export async function deleteBandNote(noteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("band_booking_notes").delete().eq("id", noteId);

  if (error) throw new Error("Failed to delete the note.");
  revalidateNotes();
}

export async function toggleBandFavorite(id: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("band_booking_requests")
    .update({ is_favorite: value })
    .eq("id", id);

  if (error) throw new Error("Failed to update favourite.");

  revalidatePath("/event-bookings/music-bookings");
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

  const plan = planBandEventSync({ status: "offered", selectedDate: record.selected_date, eventId: record.event_id });
  if (plan.action === "deactivate") {
    await updateLinkedEvent(supabase, plan.eventId, { is_active: false }, empId);
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

export async function updateBandStatus(
  id: string,
  status: BandStatus,
  emailNote?: string
): Promise<{ emailError: string | null; clashes?: ClashEvent[] }> {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: before } = await supabase
    .from("band_booking_requests")
    .select("status, selected_date, selected_start_time, selected_end_time, event_id")
    .eq("id", id)
    .single();

  if (status === "booked" && before && before.status !== "booked" && before.selected_date) {
    const clashes = await getClashingEvents(
      before.selected_date,
      before.selected_start_time,
      before.selected_end_time,
      before.event_id
    );
    if (clashes.length) return { emailError: null, clashes };
  }

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

  const plan = planBandEventSync({
    status,
    selectedDate: record.selected_date,
    eventId: record.event_id,
  });

  if (plan.action === "insert" || plan.action === "update") {
    const bandSubType = record.type?.toLowerCase() || "other";

    const { eventTypeId, eventSubtypeId } = await resolveEventSubtype(supabase, "music", bandSubType, "music_act");

    const { data: et } = await supabase
      .from("event_types")
      .select("is_bookable, booking_config, booking_card_title, booking_card_tagline, booking_card_icon, booking_card_badge")
      .eq("id", eventTypeId)
      .single();

    const eventFields = {
      title: eventTitleFor(record),
      date: record.selected_date,
      start_time: record.selected_start_time,
      end_time: record.selected_end_time,
      event_types_id: eventTypeId,
      event_subtypes_id: eventSubtypeId,
      payment_amount: 0,
      is_active: eventSlotIsComplete({
        date: record.selected_date,
        startTime: record.selected_start_time,
        endTime: record.selected_end_time,
      }),
      is_bookable: et?.is_bookable ?? false,
      booking_config: et?.booking_config ?? {},
      booking_card_title: et?.booking_card_title ?? null,
      booking_card_tagline: et?.booking_card_tagline ?? null,
      booking_card_icon: et?.booking_card_icon ?? null,
      booking_card_badge: et?.booking_card_badge ?? null,
    };

    if (plan.action === "update") {
      await updateLinkedEvent(supabase, plan.eventId, eventFields, empId);
    } else {
      const { data: newEvent } = await supabase
        .from("events")
        .insert({
          ...eventFields,
          creation_method: "band_request",
          creation_source_id: id,
          created_by: empId,
          updated_by: empId,
        })
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
    await updateLinkedEvent(supabase, plan.eventId, { is_active: false }, empId);
  }

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
