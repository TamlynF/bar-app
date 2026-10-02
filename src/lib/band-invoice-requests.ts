import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderTemplate } from "@/lib/email/resolve";
import { bandMergeValues, bandScenarioKey, buildBandEmail } from "@/lib/band-emails";
import { bandEmailHtml } from "@/lib/band-email-html";
import { sendCorrespondenceEmail } from "@/lib/email/correspondence-data";
import { INVOICE_EMAIL_KIND, isDueForInvoice } from "@/lib/band-invoice";

type InvoiceEvent = { date: string | null; start_time: string | null; end_time: string | null; is_active: boolean | null };

export type InvoiceRequestRow = {
  id: string;
  booker_name: string;
  email: string | null;
  group_name: string | null;
  payment_amount: number | null;
  event: InvoiceEvent | InvoiceEvent[] | null;
};

export const INVOICE_REQUEST_SELECT =
  "id, booker_name, email, group_name, payment_amount, event:events!band_booking_requests_event_id_fkey(date, start_time, end_time, is_active)";

export function invoiceEventOf(row: InvoiceRequestRow): InvoiceEvent | null {
  return Array.isArray(row.event) ? (row.event[0] ?? null) : row.event;
}

/* One invoice request to one booking, logged in its correspondence. Null when
   it went; "disabled" when the template is switched off. */
export async function sendInvoiceRequest(
  supabase: SupabaseClient,
  resend: Resend,
  row: InvoiceRequestRow,
  sentBy: number | null = null
): Promise<string | "disabled" | null> {
  if (!row.email) return "This booking has no email address.";
  const event = invoiceEventOf(row);
  const slots = await renderTemplate(
    supabase,
    bandScenarioKey("invoice"),
    bandMergeValues({ name: row.booker_name, groupName: row.group_name, date: event?.date, paymentAmount: row.payment_amount })
  );
  if (!slots) return "disabled";

  const email = buildBandEmail({
    slots,
    kind: "invoice",
    date: event?.date ?? null,
    startTime: event?.start_time ?? null,
    endTime: event?.end_time ?? null,
    paymentAmount: row.payment_amount,
  });
  const html = bandEmailHtml({ kind: "invoice", slots, email, groupName: row.group_name, noteHtml: "" });

  const { error } = await sendCorrespondenceEmail({
    resend,
    links: { bandRequestId: row.id },
    to: row.email,
    subject: email.subject,
    html,
    kind: INVOICE_EMAIL_KIND,
    sentBy,
    templateSlots: slots,
  });
  return error;
}

export type InvoiceRunResult = {
  due: number;
  sent: string[];
  alreadySent: number;
  failed: { id: string; error: string }[];
  disabled?: boolean;
};

/* Every booked act whose active event started in the last seven days and has
   no invoice request in its correspondence yet gets one. Sent through the
   correspondence path, so it shows in the booking's thread and a reply lands
   back on the booking; the thread is also what stops a second send. */
export async function sendDueInvoiceRequests(admin: SupabaseClient, now = new Date()): Promise<InvoiceRunResult> {
  const { data, error } = await admin
    .from("band_booking_requests")
    .select(INVOICE_REQUEST_SELECT)
    .eq("status", "booked")
    .not("event_id", "is", null);
  if (error) throw new Error(`Could not read booked acts: ${error.message}`);

  const due = ((data ?? []) as InvoiceRequestRow[])
    .map((row) => ({ row, event: invoiceEventOf(row) }))
    .filter(({ row, event }) => row.email && isDueForInvoice(event, now));
  const result: InvoiceRunResult = { due: due.length, sent: [], alreadySent: 0, failed: [] };
  if (due.length === 0) return result;

  const { data: sentRows, error: sentError } = await admin
    .from("email_messages")
    .select("band_booking_request_id")
    .eq("kind", INVOICE_EMAIL_KIND)
    .eq("direction", "outbound")
    .in(
      "band_booking_request_id",
      due.map(({ row }) => row.id)
    );
  if (sentError) throw new Error(`Could not read sent invoice requests: ${sentError.message}`);
  const already = new Set((sentRows ?? []).map((r) => r.band_booking_request_id as string));

  const resend = new Resend(process.env.RESEND_API_KEY);
  for (const { row } of due) {
    if (already.has(row.id)) {
      result.alreadySent += 1;
      continue;
    }
    const outcome = await sendInvoiceRequest(admin, resend, row);
    if (outcome === "disabled") return { ...result, disabled: true };
    if (outcome) result.failed.push({ id: row.id, error: outcome });
    else result.sent.push(row.id);
  }
  return result;
}
