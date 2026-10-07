"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { renderTemplate } from "@/lib/email/resolve";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import {
  approvePrivateHire,
  changeAgreedHire,
  closePrivateHire,
  confirmPrivateHire,
  depositOutcome,
  heldPrivateHireSlots,
  REFUND_METHOD_PHRASE,
  loadHire,
  proposePrivateHireTimes,
  refundHireDeposit,
  reopenPrivateHire,
  resendPrivateHireEmail,
  switchOffCheckout,
  syncHireEvent,
  venueToday,
  type ApprovalSource,
  type FlowContext,
  type FlowResult,
  type HireSlot,
} from "@/lib/private-hire-flow";
import {
  depositDueDate,
  dueDateForNewHireDate,
  normalizePrivateHireStatus,
  renewedDepositDue,
  resolveDepositAmount,
  refundableAmount,
  type DepositPaidVia,
  type RefundVia,
} from "@/lib/private-hire-status";
import {
  formatDeposit,
  formatHireDate,
  formatHireTime,
  heldSlotsOnDate,
  supersedeCheckout,
} from "@/lib/private-hire-details";
import type { PrivateHireEmailKey } from "@/lib/private-hire-emails";

const resend = new Resend(process.env.RESEND_API_KEY);

async function currentEmployeeId(): Promise<number | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).maybeSingle();
  return emp?.id ?? null;
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
  excludeEventId?: number | null,
  excludeRequestId?: string | null
): Promise<ClashEvent[]> {
  if (!date) return [];
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("id, title, start_time, end_time")
    .eq("date", date)
    .eq("is_active", true);
  if (excludeEventId != null) query = query.neq("id", excludeEventId);

  const [{ data }, held] = await Promise.all([
    query,
    heldPrivateHireSlots(supabase, { from: date, to: date }, excludeRequestId),
  ]);
  return findEventClashes({ start: startTime, end: endTime }, [
    ...((data ?? []) as ClashEventInput[]),
    ...heldSlotsOnDate(held, date),
  ]);
}

export async function updatePrivateHireFields(
  id: string,
  fields: {
    guest_count?: number;
    selected_date?: string | null;
    selected_start_time?: string | null;
    selected_end_time?: string | null;
    event_subtypes_id?: number;
    decline_reason?: string | null;
    deposit_amount?: number | null;
    deposit_due_date?: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const before = await loadHire(supabase, id);
  if (!before) throw new Error("Request not found.");

  /* Once the customer has agreed the times, a new slot (or, while the deposit
     is unpaid, a new amount) goes through changeAgreedHireAction so they're
     told about it - never a silent save. */
  const status = normalizePrivateHireStatus(before.status);
  const agreed = status === "awaiting_deposit" || status === "confirmed";
  const {
    deposit_amount,
    selected_date,
    selected_start_time,
    selected_end_time,
    ...rest
  } = fields;
  const saved = {
    ...rest,
    ...(agreed ? {} : { selected_date, selected_start_time, selected_end_time }),
    ...(status === "awaiting_deposit" ? {} : { deposit_amount }),
  };
  const defined = Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined));

  /* A new amount or slot means the customer's existing checkout is out of
     date, so the next "Pay deposit" click makes a fresh one. */
  const checkoutChanged =
    (defined.deposit_amount !== undefined && Number(deposit_amount) !== Number(before.deposit_amount)) ||
    (defined.selected_date !== undefined && selected_date !== before.selected_date);

  const { error } = await supabase
    .from("private_hire_requests")
    .update({
      ...defined,
      ...(checkoutChanged ? supersedeCheckout(before) : {}),
      updated_by: empId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Failed to save changes.");
  if (checkoutChanged) await switchOffCheckout(before);

  const after = await loadHire(supabase, id);
  if (after && normalizePrivateHireStatus(after.status) === "confirmed" && after.event_id) {
    await syncHireEvent({ supabase, resend, actorId: empId }, after);
  }

  revalidatePrivateHire();
}

function revalidatePrivateHire() {
  revalidatePath("/event-bookings/private-bookings");
  revalidatePath("/event-bookings/general/[type]/[subtype]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/event-setups/events");
}

async function flowContext(): Promise<FlowContext> {
  return { supabase: await createClient(), resend, actorId: await currentEmployeeId() };
}

/* Returned rather than thrown: a thrown message is hidden from the browser in
   production, and these ones tell staff why a step didn't happen. */
async function finish(result: FlowResult): Promise<FlowResult> {
  if (result.ok) revalidatePrivateHire();
  return result;
}

export async function approvePrivateHireAction(
  id: string,
  opts: { depositAmount: number | null; note?: string; source?: Exclude<ApprovalSource, "customer"> }
) {
  return finish(await approvePrivateHire(await flowContext(), id, opts));
}

export async function proposePrivateHireAction(id: string, opts: { note?: string }) {
  return finish(await proposePrivateHireTimes(await flowContext(), id, opts));
}

export async function markPrivateHireDepositPaidAction(
  id: string,
  opts: { via: Exclude<DepositPaidVia, "square" | "none">; amount: number; note?: string }
) {
  return finish(
    await confirmPrivateHire(await flowContext(), id, { via: opts.via, paidAmount: opts.amount, note: opts.note })
  );
}

export async function closePrivateHireAction(
  id: string,
  to: "declined" | "cancelled",
  note?: string,
  refund?: { amount: number; via: RefundVia } | null
) {
  return finish(await closePrivateHire(await flowContext(), id, to, { note, byStaff: true, refund }));
}

export async function refundPrivateHireDepositAction(
  id: string,
  opts: { amount: number; via: RefundVia; reason?: string; note?: string }
) {
  const result = await refundHireDeposit(await flowContext(), id, opts);
  if (result.ok) revalidatePrivateHire();
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error };
}

export async function reopenPrivateHireAction(id: string) {
  return finish(await reopenPrivateHire(await flowContext(), id));
}

export async function resendPrivateHireEmailAction(id: string, opts: { note?: string } = {}) {
  return finish(await resendPrivateHireEmail(await flowContext(), id, opts));
}

export async function changeAgreedHireAction(
  id: string,
  change: { slot?: HireSlot | null; deposit?: number | null },
  opts: { note?: string } = {}
) {
  return finish(await changeAgreedHire(await flowContext(), id, change, opts));
}

/* Lets the action dialogs preview exactly what will be sent, rather than an
   approximation built from copy compiled into the page. */
export async function privateHireEmailSlotsAction(
  key: PrivateHireEmailKey,
  id: string,
  unsaved?: {
    date: string | null;
    start: string | null;
    end: string | null;
    subtypeId: number | null;
    deposit?: number | null;
    renewOverdueDue?: boolean;
    refund?: { amount: number; via: RefundVia } | null;
  }
) {
  const supabase = await createClient();
  const loaded = await loadHire(supabase, id);
  if (!loaded) return null;
  const changedSubtype =
    unsaved?.subtypeId != null && unsaved.subtypeId !== loaded.event_subtypes_id
      ? (
          await supabase
            .from("event_subtypes")
            .select("id, name, default_event_title, event_types_id")
            .eq("id", unsaved.subtypeId)
            .maybeSingle()
        ).data
      : null;
  const row = unsaved
    ? {
        ...loaded,
        selected_date: unsaved.date,
        selected_start_time: unsaved.start,
        selected_end_time: unsaved.end,
        ...(unsaved.deposit != null ? { deposit_amount: unsaved.deposit } : {}),
        ...(changedSubtype ? { event_subtypes: changedSubtype } : {}),
      }
    : loaded;
  const settings = await supabase
    .from("company_information")
    .select("private_hire_deposit, private_hire_deposit_days")
    .limit(1)
    .maybeSingle();
  /* Before approval there's no due date yet - preview the one approving now would set. */
  const today = venueToday();
  const days = Number(settings.data?.private_hire_deposit_days) || 7;
  const dueDate =
    (unsaved?.renewOverdueDue ? renewedDepositDue(row.deposit_due_date, today, days, row.selected_date) : null) ??
    dueDateForNewHireDate(row.deposit_due_date, row.selected_date, today) ??
    depositDueDate(today, days, row.selected_date);
  return renderTemplate(supabase, key, {
    customerName: row.full_name,
    hireDate: formatHireDate(row.selected_date),
    hireTime: formatHireTime(row.selected_start_time, row.selected_end_time),
    hireReason: privateHireSubtypeLabel(unwrapSubtype(row.event_subtypes), "Private Hire"),
    depositAmount: formatDeposit(resolveDepositAmount(row.deposit_amount, settings.data?.private_hire_deposit)),
    depositDueDate: formatHireDate(dueDate),
    depositOutcome: depositOutcome(row, unsaved?.refund ?? null),
    refundAmount: formatDeposit(unsaved?.refund?.amount ?? refundableAmount(row.paid_amount, row.refunded_amount)),
    refundMethod: REFUND_METHOD_PHRASE[unsaved?.refund?.via ?? "square"],
  });
}

export async function privateHireDepositDefaultAction(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_information").select("private_hire_deposit").limit(1).maybeSingle();
  return resolveDepositAmount(null, data?.private_hire_deposit);
}

function revalidatePrivateHireNotes() {
  revalidatePath("/event-bookings/private-bookings");
}

export async function addPrivateHireNote(requestId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { error } = await supabase
    .from("private_hire_notes")
    .insert({ request_id: requestId, body: text, created_by: empId, updated_by: empId });

  if (error) throw new Error("Failed to add the note.");
  revalidatePrivateHireNotes();
}

export async function updatePrivateHireNote(noteId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("A note can't be empty.");

  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const { error } = await supabase
    .from("private_hire_notes")
    .update({ body: text, updated_by: empId, updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) throw new Error("Failed to save the note.");
  revalidatePrivateHireNotes();
}

export async function deletePrivateHireNote(noteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("private_hire_notes").delete().eq("id", noteId);

  if (error) throw new Error("Failed to delete the note.");
  revalidatePrivateHireNotes();
}
