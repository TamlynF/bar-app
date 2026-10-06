"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { findEventClashes, type ClashEvent, type ClashEventInput } from "@/lib/event-clash";
import { renderTemplate } from "@/lib/email/resolve";
import { privateHireSubtypeLabel, unwrapSubtype } from "@/lib/private-hire-subtype";
import {
  approvePrivateHire,
  closePrivateHire,
  confirmPrivateHire,
  heldPrivateHireSlots,
  loadHire,
  proposePrivateHireTimes,
  reopenPrivateHire,
  resendPrivateHireEmail,
  syncHireEvent,
  venueToday,
  type FlowContext,
  type FlowResult,
} from "@/lib/private-hire-flow";
import {
  depositDueDate,
  normalizePrivateHireStatus,
  resolveDepositAmount,
  type DepositPaidVia,
} from "@/lib/private-hire-status";
import { formatDeposit, formatHireDate, formatHireTime, heldSlotsOnDate } from "@/lib/private-hire-details";
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
    reason?: string | null;
    selected_date?: string | null;
    selected_start_time?: string | null;
    selected_end_time?: string | null;
    event_subtypes_id?: number | null;
    admin_notes?: string | null;
    deposit_amount?: number | null;
    deposit_due_date?: string | null;
  }
) {
  const supabase = await createClient();
  const empId = await currentEmployeeId();
  const before = await loadHire(supabase, id);
  if (!before) throw new Error("Request not found.");

  /* A new amount or slot means the customer's existing checkout is out of
     date, so the next "Pay deposit" click makes a fresh one. */
  const checkoutChanged =
    (fields.deposit_amount !== undefined && Number(fields.deposit_amount) !== Number(before.deposit_amount)) ||
    (fields.selected_date !== undefined && fields.selected_date !== before.selected_date);

  const { error } = await supabase
    .from("private_hire_requests")
    .update({
      ...fields,
      ...(checkoutChanged ? { payment_link_url: null, square_order_id: null } : {}),
      updated_by: empId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Failed to save changes.");

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

export async function approvePrivateHireAction(id: string, opts: { depositAmount: number | null; note?: string }) {
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

export async function closePrivateHireAction(id: string, to: "declined" | "cancelled", note?: string) {
  return finish(await closePrivateHire(await flowContext(), id, to, { note }));
}

export async function reopenPrivateHireAction(id: string) {
  return finish(await reopenPrivateHire(await flowContext(), id));
}

export async function resendPrivateHireEmailAction(id: string) {
  return finish(await resendPrivateHireEmail(await flowContext(), id));
}

/* Lets the action dialogs preview exactly what will be sent, rather than an
   approximation built from copy compiled into the page. */
export async function privateHireEmailSlotsAction(key: PrivateHireEmailKey, id: string) {
  const supabase = await createClient();
  const row = await loadHire(supabase, id);
  if (!row) return null;
  const settings = await supabase
    .from("company_information")
    .select("private_hire_deposit, private_hire_deposit_days")
    .limit(1)
    .maybeSingle();
  /* Before approval there's no due date yet - preview the one approving now would set. */
  const dueDate =
    row.deposit_due_date ??
    depositDueDate(venueToday(), Number(settings.data?.private_hire_deposit_days) || 7, row.selected_date);
  return renderTemplate(supabase, key, {
    customerName: row.full_name,
    hireDate: formatHireDate(row.selected_date),
    hireTime: formatHireTime(row.selected_start_time, row.selected_end_time),
    hireReason: privateHireSubtypeLabel(unwrapSubtype(row.event_subtypes), row.reason || row.reason_for_hire || "Private Hire"),
    depositAmount: formatDeposit(resolveDepositAmount(row.deposit_amount, settings.data?.private_hire_deposit)),
    depositDueDate: formatHireDate(dueDate),
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
