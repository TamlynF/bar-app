import { format } from "date-fns";
import {
  brandLayout,
  changeRowsHtml,
  detailRowsHtml,
  type ChangeRow,
  type DetailRow,
} from "@/lib/email/layout";
import type { MergeValues, TemplateSlots } from "@/lib/email/render";

export { ADMIN_EMAIL, EMAIL_FROM } from "@/lib/email";
export type { DetailRow };

export type BookingEmail = { subject: string; html: string };

export interface BookingSnapshot {
  bookingId: number | string;
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string | null;
  groupName: string | null;
  groupNameLabel?: string;
  groupSize: number | null;
  status: string | null;
  specialRequests: string | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
}

export type BookingChange = ChangeRow;

export function formatEventDate(date: string | null): string {
  if (!date) return "TBC";
  return format(new Date(`${date}T00:00:00`), "EEE, d MMM yyyy");
}

export function people(size: number | null): string {
  if (size == null) return "-";
  return `${size} ${size === 1 ? "Person" : "People"}`;
}

function blank(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

/* What the templates for every booking scenario can refer to. Kept next to the
   snapshot it is derived from, so a new field is added in one place. */
export function bookingMergeValues(b: BookingSnapshot): MergeValues {
  return {
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    eventTitle: b.eventTitle,
    eventDate: formatEventDate(b.eventDate),
    groupName: b.groupName?.trim() ?? "",
    groupSize: people(b.groupSize),
    groupSizeLower: people(b.groupSize).toLowerCase(),
    bookingId: String(b.bookingId),
  };
}

export function describeBookingChanges(
  before: BookingSnapshot,
  after: BookingSnapshot
): BookingChange[] {
  const changes: BookingChange[] = [];

  if ((before.groupSize ?? null) !== (after.groupSize ?? null)) {
    changes.push({ label: "Party Size", from: people(before.groupSize), to: people(after.groupSize) });
  }
  if (blank(before.groupName) !== blank(after.groupName)) {
    changes.push({
      label: after.groupNameLabel || before.groupNameLabel || "Group Name",
      from: blank(before.groupName),
      to: blank(after.groupName),
    });
  }
  if (blank(before.specialRequests) !== blank(after.specialRequests)) {
    changes.push({
      label: "Special Requests",
      from: blank(before.specialRequests),
      to: blank(after.specialRequests),
    });
  }
  if (blank(before.status)?.toLowerCase() !== blank(after.status)?.toLowerCase()) {
    changes.push({ label: "Status", from: blank(before.status), to: blank(after.status) });
  }
  if ((before.eventDate ?? null) !== (after.eventDate ?? null)) {
    changes.push({
      label: "Date",
      from: formatEventDate(before.eventDate),
      to: formatEventDate(after.eventDate),
    });
  }

  return changes;
}

/* The detail block is generated, not authored: which rows appear depends on what
   the booking actually has, and the money pair only shows on a paid booking. */
export function bookingDetailRows(b: BookingSnapshot): DetailRow[] {
  return [
    { label: "Date", value: formatEventDate(b.eventDate) },
    ...(b.groupName?.trim()
      ? [{ label: b.groupNameLabel || "Group Name", value: b.groupName.trim() }]
      : []),
    { label: "Party Size", value: people(b.groupSize) },
    ...(b.status ? [{ label: "Status", value: b.status }] : []),
    ...(b.specialRequests?.trim()
      ? [{ label: "Requests", value: b.specialRequests.trim() }]
      : []),
    ...(b.totalAmount != null && b.totalAmount > 0
      ? [
          { label: "Total", value: `£${Number(b.totalAmount).toFixed(2)}` },
          { label: "Paid", value: `£${Number(b.paidAmount ?? 0).toFixed(2)}` },
        ]
      : []),
  ];
}

function adminContactRows(b: BookingSnapshot): DetailRow[] {
  return [
    { label: "Reference", value: `#${b.bookingId}` },
    { label: "Customer", value: b.customerName },
    { label: "Email", value: b.customerEmail },
  ];
}

/* Every builder below takes copy that has already been resolved from the
   database and rendered - they compose the generated half around it. */

export function buildBookingConfirmedEmail(p: {
  slots: TemplateSlots;
  rows: DetailRow[];
  manageUrl: string;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: detailRowsHtml(p.rows),
      ctaUrl: p.manageUrl,
    }),
  };
}

export function buildBookingChangedEmail(p: {
  slots: TemplateSlots;
  changes: BookingChange[];
  manageUrl: string;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: changeRowsHtml(p.changes),
      ctaUrl: p.manageUrl,
    }),
  };
}

export function buildBookingCancelledEmail(p: {
  slots: TemplateSlots;
  booking: BookingSnapshot;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: detailRowsHtml(bookingDetailRows(p.booking)),
    }),
  };
}

export function buildAdminNewBookingEmail(p: {
  slots: TemplateSlots;
  booking: BookingSnapshot;
  adminUrl: string;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: detailRowsHtml([...adminContactRows(p.booking), ...bookingDetailRows(p.booking)]),
      ctaUrl: p.adminUrl,
    }),
  };
}

export function buildAdminBookingChangedEmail(p: {
  slots: TemplateSlots;
  booking: BookingSnapshot;
  changes: BookingChange[];
  adminUrl: string;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: [changeRowsHtml(p.changes), detailRowsHtml(adminContactRows(p.booking))].join(""),
      ctaUrl: p.adminUrl,
    }),
  };
}

export function buildAdminBookingCancelledEmail(p: {
  slots: TemplateSlots;
  booking: BookingSnapshot;
  adminUrl: string;
}): BookingEmail {
  return {
    subject: p.slots.subject,
    html: brandLayout({
      slots: p.slots,
      bodyHtml: detailRowsHtml([...adminContactRows(p.booking), ...bookingDetailRows(p.booking)]),
      ctaUrl: p.adminUrl,
    }),
  };
}
