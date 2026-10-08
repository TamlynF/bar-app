"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { type BandStatus as BandStatusType } from "@/lib/band-event-sync";
import { type ClashEvent } from "@/lib/event-clash";
import { cleanReplyFragment, htmlToPlainText } from "@/lib/email/correspondence";
import { type OutboundAttachment } from "@/lib/email/correspondence-data";
import {
  bandOfferPageUrl,
  bandSlotClashes,
  eventTitleFor,
  sendBandEmail as sendBandEmailWith,
  syncBandEvent,
  updateLinkedEvent,
} from "@/lib/band-flow";
import { bandMergeValues, bandScenarioKey, type BandEmailKind } from "@/lib/band-emails";
import { renderTemplate } from "@/lib/email/resolve";
import { INVOICE_REQUEST_SELECT, sendInvoiceRequest, type InvoiceRequestRow } from "@/lib/band-invoice-requests";
import {
  upsertContactByEmail,
  upsertMusicActFromBand,
  syncMusicActFields,
} from "@/lib/music-acts";

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_EMAIL_FILES = 5;
const MAX_EMAIL_BYTES = 9 * 1024 * 1024;

/* The confirm dialog sends its rich message and any attachments as FormData.
   The message is cut back to the editor's tag subset before it is emailed. */
async function emailExtrasFrom(
  form?: FormData
): Promise<{ notesHtml?: string; attachments?: OutboundAttachment[] }> {
  if (!form) return {};
  const raw = String(form.get("html") ?? "");
  const notesHtml = htmlToPlainText(raw).trim() ? cleanReplyFragment(raw) : "";
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_EMAIL_FILES);
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_EMAIL_BYTES) {
    throw new Error("Attachments must be under 9 MB in total.");
  }
  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type || "application/octet-stream",
    }))
  );
  return { notesHtml, attachments };
}

export type BandStatus = BandStatusType;

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
    video_urls?: string[] | null;
    video_descriptions?: string[] | null;
    social_links?: Record<string, string> | null;
    spotify_url?: string | null;
    selected_date?: string | null;
    selected_start_time?: string | null;
    selected_end_time?: string | null;
    decline_reason?: string | null;
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
  return bandSlotClashes(await createClient(), date, startTime, endTime, excludeEventId);
}

export async function rescheduleConfirmedBooking(
  id: string,
  fields: {
    selected_date: string | null;
    selected_start_time: string | null;
    selected_end_time: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .update({ ...fields, status: "offered", act_accepted_at: null, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("booker_name, email, type, group_name, selected_date, selected_start_time, selected_end_time, event_id")
    .single();

  if (error || !record) throw new Error("Failed to update booking.");

  await syncBandEvent(supabase, { id, status: "offered", record, actorId: empId });

  const emailError = await sendBandEmail(supabase, "rescheduled", {
    requestId: id,
    sentBy: empId,
    name: record.booker_name,
    email: record.email,
    groupName: record.group_name,
    date: record.selected_date,
    startTime: record.selected_start_time,
    endTime: record.selected_end_time,
    actionsUrl: bandOfferPageUrl(id),
  });

  revalidatePath("/event-bookings/music-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
  revalidatePath("/");

  return { emailError };
}

function declinedNote(reason?: string): string {
  const text = reason?.trim();
  return text
    ? `Application declined. Reason given to the act: "${text}"`
    : "Application declined. No reason was given to the act.";
}

function reopenedNote(oldReason: string | null | undefined, to: BandStatus): string {
  const text = oldReason?.trim();
  return [
    `Application reopened from declined and moved back to ${to}.`,
    text ? `The decline reason was: "${text}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function updateBandStatus(
  id: string,
  status: BandStatus,
  emailNote?: string,
  emailExtras?: FormData,
  previousPaymentAmount?: number | null
): Promise<{ emailError: string | null; clashes?: ClashEvent[] }> {
  const supabase = await createClient();
  const empId = await currentEmployeeId();

  const { data: before } = await supabase
    .from("band_booking_requests")
    .select("status, selected_date, selected_start_time, selected_end_time, event_id, decline_reason")
    .eq("id", id)
    .single();
  const reopening = before?.status === "declined" && status !== "declined";

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
      ...(status === "declined" ? { decline_reason: emailNote?.trim() || null } : {}),
      ...(reopening ? { decline_reason: null } : {}),
      ...(status === "booked" ? {} : { act_accepted_at: null }),
      ...(reopening ? { act_withdrawn_at: null } : {}),
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
  await syncBandEvent(supabase, { id, status, record, actorId: empId });

  const stageNote = reopening
    ? reopenedNote(before?.decline_reason, status)
    : status === "declined"
      ? declinedNote(emailNote)
      : null;
  if (stageNote) {
    const { error: noteError } = await supabase
      .from("band_booking_notes")
      .insert({ request_id: id, body: stageNote, created_by: empId, updated_by: empId });
    if (noteError) console.error("[band request] stage note not saved:", noteError);
  }

  let emailError: string | null = null;
  if (status === "offered" || status === "booked" || status === "declined") {
    emailError = await sendBandEmail(supabase, status, {
      requestId: id,
      sentBy: empId,
      name: record.booker_name,
      email: record.email,
      groupName: record.group_name,
      date: record.selected_date,
      startTime: record.selected_start_time,
      endTime: record.selected_end_time,
      paymentAmount: record.payment_amount,
      previousPaymentAmount,
      notes: emailNote,
      ...(await emailExtrasFrom(emailExtras)),
      ...(status === "offered" ? { actionsUrl: bandOfferPageUrl(id) } : {}),
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

type SendBandEmailParams = Parameters<typeof sendBandEmailWith>[3];

async function sendBandEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: BandEmailKind,
  p: SendBandEmailParams
): Promise<string | null> {
  return sendBandEmailWith(supabase, resend, kind, p);
}

/* Staff changed the fee on an offered or booked act and chose to tell them. */
export async function sendFeeUpdateEmail(
  id: string,
  previousPaymentAmount: number | null,
  emailNote?: string,
  emailExtras?: FormData
): Promise<{ emailError: string | null }> {
  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { data: record, error } = await supabase
    .from("band_booking_requests")
    .select("booker_name, email, group_name, selected_date, selected_start_time, selected_end_time, payment_amount")
    .eq("id", id)
    .single();
  if (error || !record) throw new Error("This booking could not be found.");

  const emailError = await sendBandEmail(supabase, "fee_updated", {
    requestId: id,
    sentBy: empId,
    name: record.booker_name,
    email: record.email,
    groupName: record.group_name,
    date: record.selected_date,
    startTime: record.selected_start_time,
    endTime: record.selected_end_time,
    paymentAmount: record.payment_amount,
    previousPaymentAmount,
    notes: emailNote,
    ...(await emailExtrasFrom(emailExtras)),
  });
  revalidatePath("/event-bookings/music-bookings");
  return { emailError };
}

/* Staff sending the after-gig invoice request by hand - the Monday job sends
   the same email on its own, and skips a booking that already has one. */
export async function sendInvoiceRequestAction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const sentBy = await currentEmployeeId();
  const { data, error } = await supabase
    .from("band_booking_requests")
    .select(INVOICE_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { error: "This booking could not be found." };
  const outcome = await sendInvoiceRequest(supabase, resend, data as unknown as InvoiceRequestRow, sentBy);
  if (outcome === "disabled") return { error: "The invoice request email is switched off in Email templates." };
  if (!outcome) revalidatePath("/event-bookings/music-bookings");
  return { error: outcome };
}
