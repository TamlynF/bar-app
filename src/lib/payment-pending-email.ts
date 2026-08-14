import { format } from "date-fns";
import { brandLayout, detailRowsHtml } from "@/lib/email/layout";
import type { MergeValues, TemplateSlots } from "@/lib/email/render";

export function paymentPendingDate(eventDate: string): string {
  return format(new Date(eventDate + "T00:00:00"), "EEEE d MMMM yyyy");
}

function tickets(groupSize: number): string {
  return `${groupSize} ${groupSize === 1 ? "Person" : "People"}`;
}

export function paymentPendingMergeValues(p: {
  name: string;
  eventTitle: string;
  eventDate: string;
  groupSize: number;
  amountDue: number;
}): MergeValues {
  return {
    customerName: p.name,
    eventTitle: p.eventTitle,
    eventDate: paymentPendingDate(p.eventDate),
    groupSize: tickets(p.groupSize),
    amountDue: `£${p.amountDue.toFixed(2)}`,
  };
}

export function buildPaymentPendingEmail(p: {
  slots: TemplateSlots;
  eventDate: string;
  groupSize: number;
  amountDue: number;
  payUrl: string;
}): { subject: string; html: string } {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: detailRowsHtml([
        { label: "Date", value: paymentPendingDate(p.eventDate) },
        { label: "Tickets", value: tickets(p.groupSize) },
        { label: "Amount Due", value: `£${p.amountDue.toFixed(2)}` },
      ]),
      ctaUrl: p.payUrl,
    }),
  };
}
