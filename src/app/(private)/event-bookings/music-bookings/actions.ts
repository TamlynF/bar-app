"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export type BandStatus = "pending" | "confirmed" | "waitlisted" | "cancelled";

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
  const { error } = await supabase
    .from("band_booking_requests")
    .update(fields)
    .eq("id", id);

  if (error) throw new Error("Failed to save changes.");

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/dashboard");
}

export async function updateBandStatus(
  id: string,
  status: BandStatus,
  adminNotes?: string
) {
  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)
    .select(
      "booker_name, email, type, genre, group_name, selected_date, selected_start_time, selected_end_time, payment_amount"
    )
    .single();

  if (error || !record) {
    throw new Error("Failed to update status.");
  }

  // When confirmed, create an event with the matching music event type
  if (status === "confirmed" && record.selected_date) {
    const bandSubType = record.type?.toLowerCase() || "other";

    // Resolve the music event type + subtype, creating both if missing
    const { eventTypeId, eventSubtypeId } = await resolveEventSubtype(supabase, "music", bandSubType, "music_act");

    const { data: newEvent } = await supabase
      .from("events")
      .insert({
        title: record.group_name || record.booker_name,
        date: record.selected_date,
        start_time: record.selected_start_time,
        end_time: record.selected_end_time,
        event_types_id: eventTypeId,
        event_subtypes_id: eventSubtypeId,
        payment_amount: record.payment_amount,
        is_active: true,
      })
      .select("id")
      .single();

    if (newEvent) {
      await supabase
        .from("band_booking_requests")
        .update({ event_id: newEvent.id })
        .eq("id", id);
    }
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

  await resend.emails.send({ from: FROM, to: email, subject, html });
}
