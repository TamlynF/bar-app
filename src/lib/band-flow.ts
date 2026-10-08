import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { sendCorrespondenceEmail, resendTemplateAttachments, type OutboundAttachment } from "@/lib/email/correspondence-data";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";
import { eventSlotIsComplete } from "@/lib/event-active";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { heldPrivateHireSlots } from "@/lib/private-hire-flow";
import { formatHireDate, formatHireTime, heldSlotsOnDate } from "@/lib/private-hire-details";
import { resolveEventSubtype } from "@/lib/resolve-event-subtype";
import { planBandEventSync, type BandStatus } from "@/lib/band-event-sync";
import { bandMergeValues, bandScenarioKey, buildBandEmail, type BandEmailKind } from "@/lib/band-emails";
import { bandEmailHtml, plainNoteHtml } from "@/lib/band-email-html";
import { siteUrl } from "@/lib/site-url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type BandFlowContext = { supabase: Db; resend: Resend; actorId: number | null };

export type BandRequestRow = {
  id: string;
  booker_name: string;
  email: string;
  group_name: string | null;
  type: string | null;
  status: string;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  payment_amount: number | null;
  event_id: number | null;
  contact_id: number | null;
  act_accepted_at: string | null;
  act_withdrawn_at: string | null;
};

export const BAND_REQUEST_ROW_SELECT =
  "id, booker_name, email, group_name, type, status, selected_date, selected_start_time, selected_end_time, payment_amount, event_id, contact_id, act_accepted_at, act_withdrawn_at";

export const bandOfferPagePath = (id: string) => `/band-offer/${id}`;
export const bandOfferPageUrl = (id: string) => `${siteUrl()}${bandOfferPagePath(id)}`;
export const bandAdminRequestUrl = (id: string) => `${siteUrl()}/event-bookings/music-bookings?request=${id}`;

export function eventTitleFor(record: { group_name: string | null; booker_name: string }): string {
  return record.group_name || record.booker_name;
}

export async function updateLinkedEvent(
  supabase: Db,
  eventId: number,
  fields: Record<string, unknown>,
  actorId: number | null
) {
  await supabase
    .from("events")
    .update({ ...fields, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", eventId);
}

/* Puts a booked act on the schedule, keeps its event in line, or takes it
   off again - whichever the new status calls for. */
export async function syncBandEvent(
  supabase: Db,
  p: {
    id: string;
    status: BandStatus;
    record: Pick<
      BandRequestRow,
      "booker_name" | "group_name" | "type" | "selected_date" | "selected_start_time" | "selected_end_time" | "event_id"
    >;
    actorId: number | null;
  }
): Promise<void> {
  const { record } = p;
  const plan = planBandEventSync({ status: p.status, selectedDate: record.selected_date, eventId: record.event_id });

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
      await updateLinkedEvent(supabase, plan.eventId, eventFields, p.actorId);
      return;
    }
    const { data: newEvent } = await supabase
      .from("events")
      .insert({
        ...eventFields,
        creation_method: "band_request",
        creation_source_id: p.id,
        created_by: p.actorId,
        updated_by: p.actorId,
      })
      .select("id")
      .single();
    if (newEvent) {
      await supabase
        .from("band_booking_requests")
        .update({ event_id: newEvent.id, updated_at: new Date().toISOString() })
        .eq("id", p.id);
    }
  } else if (plan.action === "deactivate") {
    await updateLinkedEvent(supabase, plan.eventId, { is_active: false }, p.actorId);
  }
}

export async function bandSlotClashes(
  supabase: Db,
  date: string,
  startTime: string | null,
  endTime: string | null,
  excludeEventId?: number | null
): Promise<ClashEvent[]> {
  if (!date) return [];
  let query = supabase.from("events").select("id, title, start_time, end_time").eq("date", date).eq("is_active", true);
  if (excludeEventId != null) query = query.neq("id", excludeEventId);
  const [{ data }, held] = await Promise.all([query, heldPrivateHireSlots(supabase, { from: date, to: date })]);
  return findEventClashes({ start: startTime, end: endTime }, [
    ...((data ?? []) as ClashEventInput[]),
    ...heldSlotsOnDate(held, date),
  ]);
}

/* One sender for every band email. Only the placement of the slot card and
   the note differs between them - the offer shows both above its closing
   paragraph, an outcome shows the date above and the note below. */
export async function sendBandEmail(
  supabase: Db,
  resend: Resend,
  kind: BandEmailKind,
  p: {
    requestId: string;
    sentBy: number | null;
    name: string;
    email: string;
    groupName: string | null;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    paymentAmount?: number | null;
    previousPaymentAmount?: number | null;
    notes?: string | null;
    notesHtml?: string;
    attachments?: OutboundAttachment[];
    actionsUrl?: string;
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
    previousPaymentAmount: p.previousPaymentAmount,
    notes: p.notes,
  });

  const html = bandEmailHtml({
    kind,
    slots,
    email: e,
    groupName: p.groupName,
    noteHtml: p.notesHtml ?? plainNoteHtml(e.noteLabel ?? ""),
    actionsUrl: p.actionsUrl,
  });

  const { error } = await sendCorrespondenceEmail({
    resend,
    links: { bandRequestId: p.requestId },
    to: p.email,
    subject: e.subject,
    html,
    kind,
    sentBy: p.sentBy,
    attachments: p.attachments,
    templateSlots: slots,
  });
  return error;
}

/* ── The act's offer page ───────────────────────────────────────────────── */

export type ActResponse = "accept" | "discuss" | "withdraw";

export type BandFlowResult = { ok: true; status: BandStatus } | { ok: false; error: string };

const STALE = "This offer has changed since the email was sent - refresh the page to see where it stands.";

export function bandSlotLabel(row: Pick<BandRequestRow, "selected_date" | "selected_start_time" | "selected_end_time">): string {
  if (!row.selected_date) return "a slot to be arranged";
  return `${formatHireDate(row.selected_date)}, ${formatHireTime(row.selected_start_time, row.selected_end_time)}`;
}

export const actName = (row: Pick<BandRequestRow, "group_name" | "booker_name">) => row.group_name || row.booker_name;

export function actCanRespond(row: Pick<BandRequestRow, "status" | "act_accepted_at">): boolean {
  return row.status === "offered" && !row.act_accepted_at;
}

export function actCanWithdraw(row: Pick<BandRequestRow, "status" | "act_accepted_at">): boolean {
  return (row.status === "new" || row.status === "reviewing" || row.status === "offered") && !row.act_accepted_at;
}

async function loadBandRequest(supabase: Db, id: string): Promise<BandRequestRow | null> {
  const { data } = await supabase.from("band_booking_requests").select(BAND_REQUEST_ROW_SELECT).eq("id", id).maybeSingle();
  return (data as BandRequestRow | null) ?? null;
}

async function addTeamNote(ctx: BandFlowContext, requestId: string, body: string) {
  const { error } = await ctx.supabase
    .from("band_booking_notes")
    .insert({ request_id: requestId, body, created_by: ctx.actorId, updated_by: ctx.actorId });
  if (error) console.error("[band request] note not saved:", error);
}

/* What an act writes on their offer page goes into the request's
   correspondence like an email they sent, so it sits with the rest of the
   conversation and shows as unread. */
async function logPageMessage(ctx: BandFlowContext, row: BandRequestRow, subject: string, text: string) {
  const { error } = await ctx.supabase.from("email_messages").insert({
    band_booking_request_id: row.id,
    contact_id: row.contact_id,
    direction: "inbound",
    kind: "page_response",
    from_address: row.email,
    subject,
    text_body: text,
  });
  if (error) console.error("[band request] page message not logged:", error);
}

async function sendActResponseAlert(ctx: BandFlowContext, row: BandRequestRow, response: string, message: string | null) {
  const slots = await renderTemplate(ctx.supabase, "admin.band.act_response", {
    bookerName: row.booker_name,
    groupName: actName(row),
    actResponse: response,
    eventDate: bandSlotLabel(row),
  });
  if (!slots) return;
  const panel = [
    `<p style="margin:0 0 8px;"><strong>Act:</strong> ${escapeHtml(actName(row))}</p>`,
    `<p style="margin:0 0 8px;"><strong>Contact:</strong> ${escapeHtml(row.booker_name)} &lt;${escapeHtml(row.email)}&gt;</p>`,
    `<p style="margin:0 0 8px;"><strong>Slot:</strong> ${escapeHtml(bandSlotLabel(row))}</p>`,
    row.payment_amount != null ? `<p style="margin:0 0 8px;"><strong>Fee:</strong> £${row.payment_amount}</p>` : "",
    message ? `<p style="margin:0;"><strong>Their message:</strong> ${escapeHtml(message)}</p>` : "",
  ].join("");
  await ctx.resend.emails
    .send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: slots.subject,
      html: plainLayout({
        slots,
        panelHtml: panel,
        ctaUrl: bandAdminRequestUrl(row.id),
        trailer: `Request ID: ${escapeHtml(row.id)}`,
      }),
      ...(await resendTemplateAttachments(slots)),
    })
    .catch((e) => console.error("[band request] act response alert failed:", e));
}

export async function respondAsAct(
  ctx: BandFlowContext,
  id: string,
  response: ActResponse,
  message?: string | null
): Promise<BandFlowResult> {
  const row = await loadBandRequest(ctx.supabase, id);
  if (!row) return { ok: false, error: "We couldn't find that offer." };
  const text = message?.trim().slice(0, 2000) || null;
  const now = new Date().toISOString();
  const slot = bandSlotLabel(row);
  const name = actName(row);

  if (response === "accept") {
    if (!actCanRespond(row)) return { ok: false, error: STALE };
    const slotComplete = eventSlotIsComplete({
      date: row.selected_date,
      startTime: row.selected_start_time,
      endTime: row.selected_end_time,
    });
    const clashes = slotComplete
      ? await bandSlotClashes(ctx.supabase, row.selected_date!, row.selected_start_time, row.selected_end_time, row.event_id)
      : [];
    const bookNow = slotComplete && clashes.length === 0;

    const { error } = await ctx.supabase
      .from("band_booking_requests")
      .update({ act_accepted_at: now, ...(bookNow ? { status: "booked" } : {}), updated_at: now })
      .eq("id", id)
      .eq("status", "offered");
    if (error) return { ok: false, error: "Something went wrong saving your answer. Please try again." };

    if (bookNow) {
      await syncBandEvent(ctx.supabase, { id, status: "booked", record: row, actorId: ctx.actorId });
      await sendBandEmail(ctx.supabase, ctx.resend, "booked", {
        requestId: id,
        sentBy: null,
        name: row.booker_name,
        email: row.email,
        groupName: row.group_name,
        date: row.selected_date,
        startTime: row.selected_start_time,
        endTime: row.selected_end_time,
        paymentAmount: row.payment_amount,
      });
    }
    const why = !slotComplete
      ? "the slot has no date or time yet"
      : `it now clashes with ${clashes.map((c) => c.title).join(", ")}`;
    const phrase = bookNow
      ? `accepted the offer of ${slot} on their offer page - booked and on the schedule.`
      : `accepted the offer of ${slot} on their offer page, but ${why} - sort the slot out, then mark it as booked.`;
    await Promise.all([
      addTeamNote(ctx, id, `${name} ${phrase}${text ? ` Their message: "${text}"` : ""}`),
      logPageMessage(ctx, row, `${name} accepted the offer`, [`Accepted the slot: ${slot}.`, text].filter(Boolean).join("\n\n")),
    ]);
    await sendActResponseAlert(ctx, row, bookNow ? "accepted the offer" : "accepted the offer (needs attention)", text);
    return { ok: true, status: bookNow ? "booked" : "offered" };
  }

  if (response === "discuss") {
    if (!actCanRespond(row)) return { ok: false, error: STALE };
    if (!text) return { ok: false, error: "Tell us what you'd like to discuss first." };
    await Promise.all([
      addTeamNote(ctx, id, `Message from ${name} about the offer of ${slot}: "${text}"`),
      logPageMessage(ctx, row, `${name} wants to discuss the offer`, [`About the slot: ${slot}.`, text].join("\n\n")),
    ]);
    await sendActResponseAlert(ctx, row, "wants to discuss the offer", text);
    return { ok: true, status: "offered" };
  }

  if (!actCanWithdraw(row)) return { ok: false, error: STALE };
  const { error } = await ctx.supabase
    .from("band_booking_requests")
    .update({ status: "declined", act_withdrawn_at: now, decline_reason: null, updated_at: now })
    .eq("id", id)
    .eq("status", row.status);
  if (error) return { ok: false, error: "Something went wrong saving your answer. Please try again." };
  await syncBandEvent(ctx.supabase, { id, status: "declined", record: row, actorId: ctx.actorId });
  await Promise.all([
    addTeamNote(ctx, id, `${name} withdrew their application on their offer page.${text ? ` Their message: "${text}"` : ""}`),
    logPageMessage(ctx, row, `${name} withdrew their application`, ["Withdrew the application.", text].filter(Boolean).join("\n\n")),
  ]);
  await sendActResponseAlert(ctx, row, "withdrew their application", text);
  return { ok: true, status: "declined" };
}
