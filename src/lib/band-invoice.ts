import { toHHMM } from "@/lib/event-clash";
import { digitsOnly, formatSortCode, isUsableAccount, type BankAccount } from "@/lib/bank-accounts";
import type { InvoiceFields } from "@/lib/invoice-pdf";

/* The weekly invoice request: who is due one, and what a returned invoice
   gives us. Server-free so it can be tested on its own. */

export const INVOICE_EMAIL_KIND = "invoice";
export const INVOICE_WINDOW_DAYS = 7;

const VENUE_TIME_ZONE = "Europe/London";

/* "YYYY-MM-DDTHH:mm" on the venue's wall clock, which is how event rows store
   their date and start time - so the two compare as plain strings. */
export function venueStamp(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: VENUE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function venueHourAndDay(at: Date): { hour: number; weekday: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: VENUE_TIME_ZONE,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return { hour: Number(parts.hour), weekday: String(parts.weekday) };
}

export function invoiceWindow(now: Date): { from: string; to: string } {
  const from = new Date(now.getTime() - INVOICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from: venueStamp(from), to: venueStamp(now) };
}

export function eventStamp(date: string, startTime: string | null | undefined): string {
  return `${date}T${toHHMM(startTime) || "00:00"}`;
}

/* An event counts once it has started and for seven days after. */
export function isDueForInvoice(
  event: { date: string | null; start_time: string | null; is_active: boolean | null } | null,
  now: Date
): boolean {
  if (!event?.date || !event.is_active) return false;
  const stamp = eventStamp(event.date, event.start_time);
  const { from, to } = invoiceWindow(now);
  return stamp >= from && stamp <= to;
}

export function invoiceAccount(fields: InvoiceFields, receivedAt: string): BankAccount | null {
  const account: BankAccount = {
    account_name: fields.accountName,
    account_no: digitsOnly(fields.accountNo),
    sort_code: formatSortCode(fields.sortCode),
    payment_ref: fields.invoiceNo,
    source: fields.invoiceNo ? `Invoice ${fields.invoiceNo}` : "Invoice",
    added_at: receivedAt,
  };
  return isUsableAccount(account) ? account : null;
}

export function isPdfAttachment(a: { name: string; contentType?: string | null }): boolean {
  return a.contentType === "application/pdf" || /\.pdf$/i.test(a.name);
}

export function mentionsInvoice(subject: string, fileNames: string[]): boolean {
  return [subject, ...fileNames].some((t) => /invoice|\binv(?![a-z])|payment request/i.test(t));
}
