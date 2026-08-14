"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planBandEventSync, type BandStatus as BandStatusType } from "@/lib/band-event-sync";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { eventSlotIsComplete } from "@/lib/event-active";
import {
  bandMergeValues,
  bandScenarioKey,
  bandSlotCardLabel,
  buildBandEmail,
  type BandEmailKind,
} from "@/lib/band-emails";
import { renderTemplate } from "@/lib/email/resolve";
import { bandCard, bandLayout, bandNote } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";
import {
  upsertContactByEmail,
  upsertMusicActFromBand,
  syncMusicActFields,
} from "@/lib/music-acts";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const emailError = await sendBandEmail(supabase, "rescheduled", {
    name: record.booker_name,
    email: record.email,
    groupName: record.group_name,
    date: record.selected_date,
    startTime: record.selected_start_time,
    endTime: record.selected_end_time,
  });

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
  if (status === "offered" || status === "booked" || status === "declined") {
    emailError = await sendBandEmail(supabase, status, {
      name: record.booker_name,
      email: record.email,
      groupName: record.group_name,
      date: record.selected_date,
      startTime: record.selected_start_time,
      endTime: record.selected_end_time,
      paymentAmount: record.payment_amount,
      notes: emailNote,
    });
  }

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");

  return { emailError };
}


/* Lets the status dialog preview the copy that will actually be sent, rather
   than an approximation compiled into the page. */
export async function bandEmailSlotsAction(
  kind: BandEmailKind,
  name: string,
  groupName: string | null
) {
  const supabase = await createClient();
  return renderTemplate(supabase, bandScenarioKey(kind), bandMergeValues({ name, groupName }));
}

/* One sender for all four band emails. Only the placement of the slot card and
   the note differs between them - the offer shows both above its closing
   paragraph, an outcome shows the date above and the note below. */
async function sendBandEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: BandEmailKind,
  p: {
    name: string;
    email: string;
    groupName: string | null;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    paymentAmount?: number | null;
    notes?: string | null;
  }
): Promise<string | null> {
  const slots = await renderTemplate(
    supabase,
    bandScenarioKey(kind),
    bandMergeValues({ name: p.name, groupName: p.groupName })
  );
  if (!slots) return null;

  const e = buildBandEmail({
    slots,
    kind,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    paymentAmount: p.paymentAmount,
    notes: p.notes,
  });

  const card =
    kind === "offered"
      ? bandCard(bandSlotCardLabel(kind), escapeHtml(e.slotLabel ?? ""), escapeHtml(e.feeLabel ?? ""))
      : e.dateLabel
        ? bandCard(bandSlotCardLabel(kind), escapeHtml(e.dateLabel), escapeHtml(e.timeLabel))
        : "";

  const note = bandNote(escapeHtml(e.noteLabel ?? ""));

  const html = bandLayout({
    slots,
    groupName: p.groupName ? escapeHtml(p.groupName) : null,
    middleHtml: kind === "offered" ? card + note : card,
    tailHtml: kind === "offered" ? "" : note,
  });

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: p.email,
    subject: e.subject,
    html,
  });
  if (error) {
    console.error(`[band ${kind} email] Resend failed:`, JSON.stringify(error));
    return error.message ?? "Email failed to send.";
  }
  console.log(`[band ${kind} email] sent:`, data?.id, "→", p.email);
  return null;
}
