import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
import { sendCorrespondenceEmail, resendTemplateAttachments } from "@/lib/email/correspondence-data";
import { renderTemplate } from "@/lib/email/resolve";
import { plainLayout, plainNote, plainPanel } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/escape";
import { eventSlotIsComplete } from "@/lib/event-active";
import { toHHMM } from "@/lib/event-clash";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import { siteUrl } from "@/lib/site-url";
import { getContactEmail } from "@/lib/company-info";
import { venueStamp } from "@/lib/band-invoice";
import { squareClient } from "@/lib/square";
import { buildCheckoutOptions, buildPrePopulatedData, poundsToPence } from "@/lib/square-order";
import { toE164 } from "@/lib/phone";
import {
  canMovePrivateHire,
  depositDueDate,
  depositPaymentStatus,
  dueDateForNewHireDate,
  effectivePrivateHireStatus,
  normalizePrivateHireStatus,
  resolveDepositAmount,
  shouldSendDepositReminder,
  DEPOSIT_PAID_VIA_LABEL,
  statusValues,
  DEFAULT_DEPOSIT_DAYS,
  type DepositPaidVia,
  type PrivateHireStatus,
} from "@/lib/private-hire-status";
import {
  formatDeposit,
  formatHireDate,
  formatHireTime,
  hireDetailRows,
  supersedeCheckout,
  type HeldHireSlot,
} from "@/lib/private-hire-details";

/* Every step a private hire request takes after it is submitted: staff
   approving or proposing times, the customer answering from their request
   page, the deposit being paid (Square webhook or staff), closing, and the
   nightly deposit job. Each step re-reads the row and only moves it if the
   status still allows, so a stale tab or an old email link can't act twice. */

type Db = SupabaseClient;

export type FlowContext = {
  supabase: Db;
  resend: Resend;
  actorId: number | null;
  now?: Date;
};

export type FlowResult = { ok: true; status: PrivateHireStatus } | { ok: false; error: string };

type SubtypeJoin = { id: number; name: string; default_event_title: string | null; event_types_id: number };

export type HireRow = {
  id: string;
  full_name: string;
  email: string;
  contact_id: number | null;
  phone_no: string | null;
  guest_count: number;
  status: string;
  event_id: number | null;
  event_subtypes_id: number;
  selected_date: string | null;
  selected_start_time: string | null;
  selected_end_time: string | null;
  deposit_amount: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  deposit_paid_via: string | null;
  deposit_due_date: string | null;
  deposit_reminded_at: string | null;
  payment_link_url: string | null;
  square_payment_link_id: string | null;
  square_order_id: string | null;
  square_payment_id: string | null;
  superseded_square_order_ids: string[] | null;
  event_subtypes: SubtypeJoin | SubtypeJoin[] | null;
};

const HIRE_SELECT =
  "id, full_name, email, contact_id, phone_no, guest_count, status, event_id, event_subtypes_id, selected_date, selected_start_time, selected_end_time, deposit_amount, paid_amount, payment_status, deposit_paid_via, deposit_due_date, deposit_reminded_at, payment_link_url, square_payment_link_id, square_order_id, square_payment_id, superseded_square_order_ids, event_subtypes:event_subtypes_id ( id, name, default_event_title, event_types_id )";

const STALE = "This request has moved on since you opened it - refresh to see where it is now.";

export function venueToday(now: Date = new Date()): string {
  return venueStamp(now).slice(0, 10);
}

export function requestPageUrl(id: string): string {
  return `${siteUrl()}/private-hire/${id}`;
}

function adminRequestUrl(id: string): string {
  return `${siteUrl()}/event-bookings/private-bookings?open=${id}`;
}

export async function loadHire(supabase: Db, id: string): Promise<HireRow | null> {
  const { data } = await supabase.from("private_hire_requests").select(HIRE_SELECT).eq("id", id).maybeSingle();
  return (data as HireRow | null) ?? null;
}

async function depositSettings(supabase: Db): Promise<{ amount: number | null; days: number }> {
  const { data } = await supabase
    .from("company_information")
    .select("private_hire_deposit, private_hire_deposit_days")
    .limit(1)
    .maybeSingle();
  return {
    amount: data?.private_hire_deposit != null ? Number(data.private_hire_deposit) : null,
    days: Number(data?.private_hire_deposit_days) || DEFAULT_DEPOSIT_DAYS,
  };
}

function reasonLabel(row: HireRow): string {
  const sub = unwrapSubtype(row.event_subtypes);
  return privateHireSubtypeLabel(sub, "Private Hire");
}

function slotIsSet(row: HireRow): boolean {
  return !!row.selected_date && !!row.selected_start_time && !!row.selected_end_time;
}

/* Square payment links stay payable until they're deleted, so a checkout the
   customer no longer needs is switched off there too. Rows from before the
   link id was kept can't be, which is what the superseded orders cover. */
export async function switchOffCheckout(row: Pick<HireRow, "id" | "square_payment_link_id">): Promise<void> {
  if (!row.square_payment_link_id) return;
  try {
    await squareClient.checkout.paymentLinks.delete({ id: row.square_payment_link_id });
  } catch (err) {
    console.error(`[private hire] couldn't switch off the Square link for ${row.id}:`, squareErrorDetail(err));
  }
}

/* Moves the row only if it is still in the status it was read in. */
async function moveRow(
  ctx: FlowContext,
  row: HireRow,
  to: PrivateHireStatus,
  fields: Record<string, unknown> = {}
): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("private_hire_requests")
    .update({ ...fields, status: to, updated_by: ctx.actorId, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id");
  if (error) console.error(`[private hire] move to ${to} failed:`, error);
  return !error && (data?.length ?? 0) > 0;
}

/* ── Emails ─────────────────────────────────────────────────────────────── */

function mergeValues(row: HireRow, extra: Record<string, string> = {}) {
  return {
    customerName: row.full_name,
    hireDate: formatHireDate(row.selected_date),
    hireTime: formatHireTime(row.selected_start_time, row.selected_end_time),
    hireReason: reasonLabel(row),
    depositAmount: formatDeposit(row.deposit_amount),
    depositDueDate: formatHireDate(row.deposit_due_date),
    ...extra,
  };
}

function detailsHtml(row: HireRow, withDeposit: boolean): string {
  const rows = hireDetailRows({
    date: row.selected_date,
    start: row.selected_start_time,
    end: row.selected_end_time,
    guests: row.guest_count,
    reason: reasonLabel(row),
    deposit: withDeposit ? row.deposit_amount : null,
    depositDue: withDeposit ? row.deposit_due_date : null,
  });
  return rows
    .map((r) => `<p style="margin:4px 0;"><strong>${escapeHtml(r.label)}:</strong> ${escapeHtml(r.value)}</p>`)
    .join("");
}

async function sendCustomerEmail(
  ctx: FlowContext,
  row: HireRow,
  key: string,
  kind: string,
  opts: { note?: string | null; deposit?: boolean; details?: boolean } = {}
): Promise<void> {
  const slots = await renderTemplate(ctx.supabase, key, mergeValues(row));
  if (!slots) return;
  const note = opts.note?.trim() ? plainNote(escapeHtml(opts.note.trim())) : "";
  const details = opts.details === false ? "" : plainPanel(detailsHtml(row, !!opts.deposit));
  const { error } = await sendCorrespondenceEmail({
    resend: ctx.resend,
    links: { privateHireRequestId: row.id },
    to: row.email,
    subject: slots.subject,
    templateSlots: slots,
    html: plainLayout({ slots, bodyHtml: details + note, ctaUrl: requestPageUrl(row.id) }),
    kind,
    sentBy: ctx.actorId,
  });
  if (error) console.error(`[private hire] ${key} email failed:`, error);
}

async function sendAdminAlert(ctx: FlowContext, row: HireRow, key: string, extra: Record<string, string> = {}) {
  const slots = await renderTemplate(ctx.supabase, key, mergeValues(row, extra));
  if (!slots) return;
  await ctx.resend.emails
    .send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: slots.subject,
      html: plainLayout({
        slots,
        panelHtml: detailsHtml(row, true),
        ctaUrl: adminRequestUrl(row.id),
        trailer: `Request ID: ${escapeHtml(row.id)}`,
      }),
      ...(await resendTemplateAttachments(slots)),
    })
    .catch((e) => console.error(`[private hire] ${key} alert failed:`, e));
}

/* ── The linked event ───────────────────────────────────────────────────── */

async function eventTypeBookingFields(supabase: Db, eventTypeId: number) {
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

/* Puts a confirmed hire on the schedule, or brings its existing event back
   in line with the request. */
export async function syncHireEvent(ctx: FlowContext, row: HireRow): Promise<void> {
  if (!row.selected_date) return;
  const sub = unwrapSubtype(row.event_subtypes);
  if (!sub) {
    console.error(`[private hire] ${row.id} has no event subtype, so no event was placed`);
    return;
  }
  const eventTypeId = sub.event_types_id;
  const eventSubtypeId = sub.id;

  const now = new Date().toISOString();
  const eventFields = {
    title: `${row.full_name} - ${reasonLabel(row)}`,
    date: row.selected_date,
    start_time: row.selected_start_time,
    end_time: row.selected_end_time,
    event_types_id: eventTypeId,
    event_subtypes_id: eventSubtypeId,
    payment_amount: 0,
    is_active: eventSlotIsComplete({
      date: row.selected_date,
      startTime: row.selected_start_time,
      endTime: row.selected_end_time,
    }),
    ...(await eventTypeBookingFields(ctx.supabase, eventTypeId)),
    updated_by: ctx.actorId,
    updated_at: now,
  };

  if (row.event_id) {
    await ctx.supabase.from("events").update(eventFields).eq("id", row.event_id);
    return;
  }

  const { data: created } = await ctx.supabase
    .from("events")
    .insert({
      ...eventFields,
      creation_method: "private_hire_request",
      creation_source_id: row.id,
      created_by: ctx.actorId,
      created_at: now,
    })
    .select("id")
    .single();
  if (created) {
    await ctx.supabase.from("private_hire_requests").update({ event_id: created.id }).eq("id", row.id);
  }
}

async function deactivateHireEvent(ctx: FlowContext, row: HireRow) {
  if (row.event_id) await ctx.supabase.from("events").update({ is_active: false }).eq("id", row.event_id);
}

/* ── Steps ──────────────────────────────────────────────────────────────── */

/* Agrees the selected times and asks for the deposit. A £0 deposit skips
   straight to confirmed. */
export async function approvePrivateHire(
  ctx: FlowContext,
  id: string,
  opts: { depositAmount?: number | null; note?: string | null } = {}
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  if (!slotIsSet(row)) return { ok: false, error: "Set a date, start and end time first." };

  const settings = await depositSettings(ctx.supabase);
  const amount =
    opts.depositAmount != null && opts.depositAmount >= 0
      ? Math.round(opts.depositAmount * 100) / 100
      : resolveDepositAmount(row.deposit_amount, settings.amount);

  if (amount <= 0) {
    return confirmPrivateHire(ctx, id, { via: "none", paidAmount: 0, note: opts.note });
  }

  const from = normalizePrivateHireStatus(row.status);
  if (!canMovePrivateHire(from, "awaiting_deposit")) return { ok: false, error: STALE };

  const now = ctx.now ?? new Date();
  const due = depositDueDate(venueToday(now), settings.days, row.selected_date);
  const moved = await moveRow(ctx, row, "awaiting_deposit", {
    deposit_amount: amount,
    deposit_due_date: due,
    deposit_reminded_at: null,
    approved_at: now.toISOString(),
    ...supersedeCheckout(row),
    closed_at: null,
  });
  if (!moved) return { ok: false, error: STALE };
  await switchOffCheckout(row);

  await sendCustomerEmail(
    ctx,
    { ...row, status: "awaiting_deposit", deposit_amount: amount, deposit_due_date: due },
    "private_hire.approved",
    "approved",
    { note: opts.note, deposit: true }
  );
  return { ok: true, status: "awaiting_deposit" };
}

/* Offers the customer the selected times instead of the ones they asked for. */
export async function proposePrivateHireTimes(
  ctx: FlowContext,
  id: string,
  opts: { note?: string | null } = {}
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  if (!slotIsSet(row)) return { ok: false, error: "Set a date, start and end time first." };
  if (!canMovePrivateHire(normalizePrivateHireStatus(row.status), "awaiting_customer")) {
    return { ok: false, error: STALE };
  }

  const moved = await moveRow(ctx, row, "awaiting_customer", {
    proposed_at: new Date().toISOString(),
    deposit_due_date: null,
    deposit_reminded_at: null,
    ...supersedeCheckout(row),
  });
  if (!moved) return { ok: false, error: STALE };
  await switchOffCheckout(row);

  await sendCustomerEmail(ctx, row, "private_hire.proposed", "proposed", { note: opts.note });
  return { ok: true, status: "awaiting_customer" };
}

export type HireSlot = { date: string; start: string; end: string };

/* Changes to a hire the customer has already agreed - a new date or time, a
   new deposit while it's still unpaid, or both - told to them in one email.
   A £0 deposit means none is needed, so the hire is confirmed. Any change
   while the deposit is unpaid replaces the checkout, so the customer pays
   the right amount for the right date. */
export async function changeAgreedHire(
  ctx: FlowContext,
  id: string,
  change: { slot?: HireSlot | null; deposit?: number | null },
  opts: { note?: string | null } = {}
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  const status = normalizePrivateHireStatus(row.status);
  if (status !== "awaiting_deposit" && status !== "confirmed") return { ok: false, error: STALE };

  const slot = change.slot ?? null;
  if (slot && (!slot.date || !slot.start || !slot.end)) {
    return { ok: false, error: "Set a date, start and end time first." };
  }
  const slotChanged =
    !!slot &&
    (slot.date !== row.selected_date ||
      slot.start !== toHHMM(row.selected_start_time) ||
      slot.end !== toHHMM(row.selected_end_time));

  let deposit: number | null = null;
  if (status === "awaiting_deposit" && change.deposit != null) {
    if (!Number.isFinite(change.deposit) || change.deposit < 0) {
      return { ok: false, error: "Enter a deposit of £0 or more." };
    }
    deposit = Math.round(change.deposit * 100) / 100;
  }
  const depositChanged = deposit != null && deposit !== Number(row.deposit_amount ?? 0);
  if (!slotChanged && !depositChanged) return { ok: true, status };

  const slotFields =
    slot && slotChanged
      ? {
          selected_date: slot.date,
          selected_start_time: slot.start,
          selected_end_time: slot.end,
          ...(status === "awaiting_deposit"
            ? { deposit_due_date: dueDateForNewHireDate(row.deposit_due_date, slot.date, venueToday(ctx.now)) }
            : {}),
        }
      : {};
  const updated: HireRow = {
    ...row,
    ...slotFields,
    ...(depositChanged ? { deposit_amount: deposit } : {}),
  };

  if (status === "confirmed") {
    const moved = await moveRow(ctx, row, "confirmed", slotFields);
    if (!moved) return { ok: false, error: STALE };
    await syncHireEvent(ctx, updated);
    await sendCustomerEmail(ctx, updated, "private_hire.rescheduled", "rescheduled", { note: opts.note });
    return { ok: true, status: "confirmed" };
  }

  const moved = await moveRow(ctx, row, "awaiting_deposit", {
    ...slotFields,
    ...(depositChanged ? { deposit_amount: deposit, deposit_reminded_at: null } : {}),
    ...supersedeCheckout(row),
  });
  if (!moved) return { ok: false, error: STALE };
  await switchOffCheckout(row);

  if (depositChanged && deposit === 0) {
    return confirmPrivateHire(ctx, id, { via: "none", paidAmount: 0, note: opts.note });
  }

  await sendCustomerEmail(
    ctx,
    updated,
    slotChanged ? "private_hire.rescheduled" : "private_hire.deposit_updated",
    slotChanged ? "rescheduled" : "deposit_updated",
    { note: opts.note, deposit: true }
  );
  return { ok: true, status: "awaiting_deposit" };
}

/* Records the deposit and confirms the hire. Safe to call twice: a request
   that is already confirmed is left alone. */
export async function confirmPrivateHire(
  ctx: FlowContext,
  id: string,
  opts: {
    via: DepositPaidVia;
    paidAmount: number;
    squarePaymentId?: string | null;
    note?: string | null;
  }
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  const from = normalizePrivateHireStatus(row.status);
  if (from === "confirmed") return { ok: true, status: "confirmed" };
  if (!canMovePrivateHire(from, "confirmed")) return { ok: false, error: STALE };
  if (!slotIsSet(row)) return { ok: false, error: "Set a date, start and end time first." };

  const now = new Date().toISOString();
  const paid = Math.max(0, Math.round(opts.paidAmount * 100) / 100);
  const paymentStatus = depositPaymentStatus(paid, row.deposit_amount);
  const moved = await moveRow(ctx, row, "confirmed", {
    paid_amount: paid,
    payment_status: paymentStatus,
    deposit_paid_at: paid > 0 ? now : null,
    deposit_paid_via: opts.via,
    ...(opts.squarePaymentId ? { square_payment_id: opts.squarePaymentId } : {}),
    confirmed_at: now,
    closed_at: null,
    payment_link_url: null,
    square_payment_link_id: null,
  });
  if (!moved) {
    const latest = await loadHire(ctx.supabase, id);
    return normalizePrivateHireStatus(latest?.status) === "confirmed"
      ? { ok: true, status: "confirmed" }
      : { ok: false, error: STALE };
  }

  const manual = opts.via === "bank_transfer" || opts.via === "cash" || opts.via === "other";
  if (manual) {
    await switchOffCheckout(row);
    const owed = Math.max(0, (Number(row.deposit_amount) || 0) - paid);
    const { error } = await ctx.supabase.from("private_hire_notes").insert({
      request_id: id,
      created_by: ctx.actorId,
      body: [
        `Deposit marked paid: ${formatDeposit(paid)} by ${DEPOSIT_PAID_VIA_LABEL[opts.via].toLowerCase()}.`,
        paymentStatus === "partially_paid"
          ? `${formatDeposit(owed)} of the ${formatDeposit(row.deposit_amount)} deposit is still owed.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    if (error) console.error("[private hire] paid note not saved:", error);
  }

  const confirmed = { ...row, status: "confirmed", paid_amount: paid };
  await syncHireEvent(ctx, confirmed);
  await sendCustomerEmail(ctx, confirmed, "private_hire.confirmed", "confirmed", { note: opts.note });
  if (opts.via === "square") {
    await sendAdminAlert(ctx, { ...confirmed, deposit_amount: paid }, "admin.private_hire.deposit_paid");
  }
  return { ok: true, status: "confirmed" };
}

/* What staff closing a request leaves in the team notes. A customer cancelling
   from their page is noted where they respond, and expiry is the nightly job. */
function closeNote(
  row: HireRow,
  to: "declined" | "cancelled" | "expired",
  opts: { note?: string | null; byStaff?: boolean }
): string | null {
  const message = opts.note?.trim();
  if (to === "declined") {
    return message
      ? `Request declined. Reason given to the customer: "${message}"`
      : "Request declined. No reason was given to the customer.";
  }
  if (to !== "cancelled" || !opts.byStaff) return null;
  const paid = Number(row.paid_amount) || 0;
  return [
    "Hire cancelled.",
    message ? `Message to the customer: "${message}"` : "No message was given to the customer.",
    paid > 0 ? `${formatDeposit(paid)} was paid - refund it in Square.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const CLOSE_EMAIL: Record<"declined" | "cancelled" | "expired", { key: string; kind: string }> = {
  declined: { key: "private_hire.declined", kind: "declined" },
  cancelled: { key: "private_hire.cancelled", kind: "cancelled" },
  expired: { key: "private_hire.expired", kind: "expired" },
};

export async function closePrivateHire(
  ctx: FlowContext,
  id: string,
  to: "declined" | "cancelled" | "expired",
  opts: { note?: string | null; notify?: boolean; byStaff?: boolean } = {}
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  const from = normalizePrivateHireStatus(row.status);
  if (!canMovePrivateHire(from, to)) return { ok: false, error: STALE };

  const moved = await moveRow(ctx, row, to, {
    closed_at: new Date().toISOString(),
    payment_link_url: null,
    square_payment_link_id: null,
    ...(to !== "expired" && opts.note?.trim() ? { decline_reason: opts.note.trim() } : {}),
  });
  if (!moved) return { ok: false, error: STALE };

  await switchOffCheckout(row);
  await deactivateHireEvent(ctx, row);
  const noteBody = closeNote(row, to, opts);
  if (noteBody) {
    const { error } = await ctx.supabase
      .from("private_hire_notes")
      .insert({ request_id: id, created_by: ctx.actorId, body: noteBody });
    if (error) console.error(`[private hire] ${to} note not saved:`, error);
  }
  if (opts.notify !== false) {
    const { kind } = CLOSE_EMAIL[to];
    const key = to === "cancelled" && from === "confirmed" ? "private_hire.booking_cancelled" : CLOSE_EMAIL[to].key;
    await sendCustomerEmail(ctx, row, key, kind, {
      note: opts.note,
      details: to !== "declined" && !!row.selected_date,
      deposit: to === "expired",
    });
  }
  return { ok: true, status: to };
}

/* Puts a declined or cancelled request back in the review queue. */
export async function reopenPrivateHire(ctx: FlowContext, id: string): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  if (!canMovePrivateHire(normalizePrivateHireStatus(row.status), "new")) return { ok: false, error: STALE };
  const moved = await moveRow(ctx, row, "new", { closed_at: null, decline_reason: null });
  return moved ? { ok: true, status: "new" } : { ok: false, error: STALE };
}

/* Sends the current stage's email again - the proposal or the deposit request. */
export async function resendPrivateHireEmail(ctx: FlowContext, id: string): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "Request not found." };
  const status = normalizePrivateHireStatus(row.status);
  if (status === "awaiting_customer") {
    await sendCustomerEmail(ctx, row, "private_hire.proposed", "proposed");
  } else if (status === "awaiting_deposit") {
    await sendCustomerEmail(ctx, row, "private_hire.approved", "approved", { deposit: true });
  } else {
    return { ok: false, error: "There's nothing waiting on the customer at this stage." };
  }
  return { ok: true, status };
}

/* ── The customer's request page ────────────────────────────────────────── */

export type CustomerResponse = "accept" | "reject" | "cancel";

const RESPONSE_PHRASE: Record<CustomerResponse, string> = {
  accept: "accepted the proposed time",
  reject: "turned down the proposed time",
  cancel: "cancelled their request",
};

/* What a customer types on their request page goes into the request's
   correspondence like an email they sent, so it sits with the rest of the
   conversation and shows as unread. */
async function logPageMessage(ctx: FlowContext, row: HireRow, subject: string, text: string) {
  const { error } = await ctx.supabase.from("email_messages").insert({
    private_hire_request_id: row.id,
    contact_id: row.contact_id,
    direction: "inbound",
    kind: "page_response",
    from_address: row.email,
    subject,
    text_body: text,
  });
  if (error) console.error("[private hire] page message not logged:", error);
}

export async function respondAsCustomer(
  ctx: FlowContext,
  id: string,
  response: CustomerResponse,
  message?: string | null
): Promise<FlowResult> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { ok: false, error: "We couldn't find that request." };
  const status = effectivePrivateHireStatus(
    normalizePrivateHireStatus(row.status),
    row.deposit_due_date,
    venueToday(ctx.now)
  );
  const text = message?.trim().slice(0, 2000) || null;

  let result: FlowResult;
  if (response === "accept") {
    if (status !== "awaiting_customer") return { ok: false, error: STALE };
    result = await approvePrivateHire(ctx, id);
  } else if (response === "reject") {
    if (status !== "awaiting_customer") return { ok: false, error: STALE };
    const moved = await moveRow(ctx, row, "new");
    result = moved ? { ok: true, status: "new" } : { ok: false, error: STALE };
  } else {
    if (status !== "new" && status !== "awaiting_customer" && status !== "awaiting_deposit") {
      return { ok: false, error: STALE };
    }
    result = await closePrivateHire(ctx, id, "cancelled");
  }
  if (!result.ok) return result;

  /* Every response is recorded, with the time it was about, so the
     request's history shows exactly what the customer said yes or no to. */
  const proposedSlot = row.selected_date
    ? `${formatHireDate(row.selected_date)}, ${formatHireTime(row.selected_start_time, row.selected_end_time)}`
    : null;
  const aboutSlot = proposedSlot ? `${RESPONSE_PHRASE[response]} (${proposedSlot})` : RESPONSE_PHRASE[response];
  const noteBody = text
    ? `Message from ${row.full_name} (${aboutSlot}): ${text}`
    : `${row.full_name} ${aboutSlot} on their request page.`;
  const summary =
    response === "cancel"
      ? `Cancelled their request${proposedSlot ? ` for ${proposedSlot}` : ""}.`
      : `${response === "accept" ? "Accepted" : "Turned down"} the proposed time: ${proposedSlot ?? "TBC"}.`;
  const pageText = [summary, text].filter(Boolean).join("\n\n");
  await Promise.all([
    ctx.supabase.from("private_hire_notes").insert({ request_id: id, body: noteBody }),
    logPageMessage(ctx, row, `${row.full_name} ${aboutSlot}`, pageText),
  ]);
  if (response === "reject") {
    await sendCustomerEmail(ctx, row, "private_hire.time_turned_down", "time_turned_down", { details: false });
  }
  await sendAdminAlert(ctx, row, "admin.private_hire.customer_response", {
    customerResponse: aboutSlot + (text ? ` - "${text}"` : ""),
  });
  return result;
}

/* A Square checkout for the deposit. The link is kept on the row so every
   "Pay deposit" click reuses the same order; changing the amount or the
   times clears it. */
export async function depositCheckoutUrl(
  ctx: FlowContext,
  id: string
): Promise<{ url: string } | { error: string }> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return { error: "We couldn't find that request." };
  const status = effectivePrivateHireStatus(
    normalizePrivateHireStatus(row.status),
    row.deposit_due_date,
    venueToday(ctx.now)
  );
  if (status === "confirmed") return { error: "Your deposit is already paid - thank you!" };
  if (status !== "awaiting_deposit") return { error: "This request isn't waiting for a deposit." };

  const pence = poundsToPence(row.deposit_amount);
  if (pence <= 0) return { error: "There's no deposit to pay on this request." };
  if (row.payment_link_url && row.square_order_id) return { url: row.payment_link_url };
  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    console.error("[private hire] Square is not configured - set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.");
    return { error: "Online payments are unavailable right now. Please reply to your email and we'll help." };
  }

  const locationId = process.env.SQUARE_LOCATION_ID;
  const supportEmail = await getContactEmail();
  const createLink = (buyerPhone: string | undefined) =>
    squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId,
        referenceId: row.id,
        metadata: { private_hire_request_id: row.id },
        lineItems: [
          {
            name: `Private hire deposit - ${row.full_name} - ${reasonLabel(row)} - ${formatHireDate(row.selected_date)}`,
            quantity: "1",
            basePriceMoney: { amount: BigInt(pence), currency: "GBP" },
          },
        ],
      },
      checkoutOptions: buildCheckoutOptions({ redirectUrl: `${requestPageUrl(row.id)}?paid=1`, supportEmail }),
      prePopulatedData: buildPrePopulatedData({ email: row.email, fullName: row.full_name, buyerPhone }),
    });

  try {
    /* Square only takes international numbers, and a phone it still refuses
       shouldn't stop anyone paying - so the second try leaves it out. */
    const phone = toE164(row.phone_no);
    let response;
    try {
      response = await createLink(phone);
    } catch (err) {
      if (!phone || squareErrorCode(err) !== "INVALID_PHONE_NUMBER") throw err;
      response = await createLink(undefined);
    }
    const { paymentLink } = response;
    if (!paymentLink?.url || !paymentLink.orderId) throw new Error("Square returned no link");
    await ctx.supabase
      .from("private_hire_requests")
      .update({
        payment_link_url: paymentLink.url,
        square_payment_link_id: paymentLink.id ?? null,
        square_order_id: paymentLink.orderId,
      })
      .eq("id", row.id);
    return { url: paymentLink.url };
  } catch (err) {
    console.error("[private hire] Square payment link error:", squareErrorDetail(err));
    return { error: "We couldn't start the payment just now. Please try again in a minute." };
  }
}

function squareErrors(err: unknown): { code?: string; detail?: string; field?: string }[] {
  const errors = (err as { errors?: unknown })?.errors;
  return Array.isArray(errors) ? errors : [];
}

function squareErrorCode(err: unknown): string | undefined {
  return squareErrors(err)[0]?.code;
}

function squareErrorDetail(err: unknown): string {
  const errors = squareErrors(err);
  return errors.length ? JSON.stringify(errors) : err instanceof Error ? err.message : String(err);
}

/* The Square webhook's half: a completed payment whose order belongs to a
   private hire deposit. Returns false when the order isn't one of ours. */
export async function settleHireDeposit(
  ctx: FlowContext,
  orderId: string,
  paidPence: number | null,
  paymentId: string | null
): Promise<boolean> {
  const { data: current } = await ctx.supabase
    .from("private_hire_requests")
    .select("id, deposit_amount")
    .eq("square_order_id", orderId)
    .maybeSingle();
  const { data: superseded } = current
    ? { data: null }
    : await ctx.supabase
        .from("private_hire_requests")
        .select("id, deposit_amount")
        .contains("superseded_square_order_ids", [orderId])
        .maybeSingle();
  const data = current ?? superseded;
  if (!data) return false;
  const paid = paidPence != null ? paidPence / 100 : Number(data.deposit_amount) || 0;
  if (await recordPaymentOnConfirmedHire(ctx, data.id, paid, paymentId)) return true;
  const result = await confirmPrivateHire(ctx, data.id, { via: "square", paidAmount: paid, squarePaymentId: paymentId });
  if (!result.ok) {
    const recorded = await recordPaymentOnClosedHire(ctx, data.id, paid, paymentId);
    if (!recorded) console.error(`[private hire] deposit for ${data.id} paid but not confirmed: ${result.error}`);
  }
  return true;
}

/* A card payment for a hire that's already confirmed - most often paid another
   way and marked paid, then the old checkout paid as well. The first payment
   stays as recorded; this one is noted and the team told, since the customer
   has probably paid twice. Returns false when the hire isn't confirmed. */
async function recordPaymentOnConfirmedHire(
  ctx: FlowContext,
  id: string,
  paid: number,
  paymentId: string | null
): Promise<boolean> {
  const row = await loadHire(ctx.supabase, id);
  if (!row || normalizePrivateHireStatus(row.status) !== "confirmed") return false;
  if (paymentId && row.square_payment_id === paymentId) return true;
  if (paymentId) {
    const { data: seen } = await ctx.supabase
      .from("private_hire_notes")
      .select("id")
      .eq("request_id", id)
      .ilike("body", `%${paymentId}%`)
      .limit(1);
    if (seen?.length) return true;
  }

  const amount = Math.max(0, Math.round(paid * 100) / 100);
  const via = row.deposit_paid_via as DepositPaidVia | null;
  const earlier =
    via && via !== "none"
      ? `${formatDeposit(row.paid_amount)} by ${DEPOSIT_PAID_VIA_LABEL[via].toLowerCase()}`
      : "no deposit";
  await ctx.supabase.from("private_hire_notes").insert({
    request_id: id,
    body: `${formatDeposit(amount)} was paid by card after this hire was already confirmed (${earlier}). The customer may have paid twice - refund it in Square.${paymentId ? ` Square payment ${paymentId}.` : ""}`,
  });
  await sendAdminAlert(ctx, { ...row, deposit_amount: amount }, "admin.private_hire.extra_payment", {
    earlierPayment: earlier,
  });
  return true;
}

/* A customer can still pay a checkout they had open after the request was
   cancelled, declined or expired. The money is in Square either way, so it's
   written onto the request and the team is told to refund or reopen it. */
async function recordPaymentOnClosedHire(
  ctx: FlowContext,
  id: string,
  paid: number,
  paymentId: string | null
): Promise<boolean> {
  const row = await loadHire(ctx.supabase, id);
  if (!row) return false;
  const status = normalizePrivateHireStatus(row.status);
  if (status !== "cancelled" && status !== "declined" && status !== "expired") return false;
  if (paymentId && row.square_payment_id === paymentId) return true;

  const amount = Math.max(0, Math.round(paid * 100) / 100);
  const now = new Date().toISOString();
  const { error } = await ctx.supabase
    .from("private_hire_requests")
    .update({
      paid_amount: amount,
      payment_status: "paid",
      deposit_paid_at: now,
      deposit_paid_via: "square",
      ...(paymentId ? { square_payment_id: paymentId } : {}),
      updated_at: now,
    })
    .eq("id", id);
  if (error) {
    console.error(`[private hire] payment on closed request ${id} not recorded:`, error);
    return false;
  }

  await ctx.supabase.from("private_hire_notes").insert({
    request_id: id,
    body: `${formatDeposit(amount)} was paid by card after this request was ${status}. Refund it in Square, or reopen the request if the hire is going ahead.`,
  });
  await sendAdminAlert(ctx, { ...row, deposit_amount: amount }, "admin.private_hire.closed_payment", {
    requestStatus: status,
  });
  return true;
}

/* ── Holds and the nightly job ──────────────────────────────────────────── */

export async function heldPrivateHireSlots(
  supabase: Db,
  range: { from: string; to?: string },
  excludeRequestId?: string | null
): Promise<HeldHireSlot[]> {
  let query = supabase
    .from("private_hire_requests")
    .select("id, full_name, selected_date, selected_start_time, selected_end_time")
    .in("status", statusValues("awaiting_deposit"))
    .gte("deposit_due_date", range.from)
    .gte("selected_date", range.from);
  if (range.to) query = query.lte("selected_date", range.to);
  if (excludeRequestId) query = query.neq("id", excludeRequestId);
  const { data } = await query;
  return (data ?? []) as HeldHireSlot[];
}

export async function runDepositDeadlines(
  ctx: FlowContext
): Promise<{ reminded: string[]; expired: string[]; failed: string[] }> {
  const today = venueToday(ctx.now);
  const { data } = await ctx.supabase
    .from("private_hire_requests")
    .select("id, status, deposit_due_date, deposit_reminded_at")
    .in("status", statusValues("awaiting_deposit"));

  const reminded: string[] = [];
  const expired: string[] = [];
  const failed: string[] = [];
  for (const r of data ?? []) {
    const status = normalizePrivateHireStatus(r.status);
    try {
      if (effectivePrivateHireStatus(status, r.deposit_due_date, today) === "expired") {
        const res = await closePrivateHire(ctx, r.id, "expired");
        (res.ok ? expired : failed).push(r.id);
      } else if (
        shouldSendDepositReminder({ status, dueDate: r.deposit_due_date, remindedAt: r.deposit_reminded_at, today })
      ) {
        const row = await loadHire(ctx.supabase, r.id);
        if (!row) continue;
        await ctx.supabase
          .from("private_hire_requests")
          .update({ deposit_reminded_at: new Date().toISOString() })
          .eq("id", r.id);
        await sendCustomerEmail(ctx, row, "private_hire.deposit_reminder", "deposit_reminder", { deposit: true });
        reminded.push(r.id);
      }
    } catch (e) {
      console.error(`[private hire] deposit job failed for ${r.id}:`, e);
      failed.push(r.id);
    }
  }
  return { reminded, expired, failed };
}
