import { format } from "date-fns";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bookingsdonfenticas.co.uk";
export const EMAIL_FROM = "Don Fenticas <admin@bookingsdonfenticas.co.uk>";

export type BookingEmail = { subject: string; html: string };

export type DetailRow = { label: string; value: string };

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

export type BookingChange = { label: string; from: string; to: string };

function formatEventDate(date: string | null): string {
  if (!date) return "TBC";
  return format(new Date(`${date}T00:00:00`), "EEE, d MMM yyyy");
}

function people(size: number | null): string {
  if (size == null) return "-";
  return `${size} ${size === 1 ? "Person" : "People"}`;
}

function blank(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
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

function detailRowsHtml(rows: DetailRow[]): string {
  return rows
    .map((row, index) => {
      const spacing = index === rows.length - 1 ? "" : "padding-bottom: 16px; ";
      return `
              <tr>
                <td style="${spacing}color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900; white-space: nowrap; padding-right: 12px;">${row.label}</td>
                <td style="${spacing}text-align: right; font-weight: 900; color: #1F1F1A;">${row.value}</td>
              </tr>`;
    })
    .join("");
}

function changeRowsHtml(changes: BookingChange[]): string {
  return changes
    .map(
      (change) => `
              <tr>
                <td style="padding-bottom: 6px; color: #5F624F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900;">${change.label}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px; color: #1F1F1A; font-weight: 900;">
                  <span style="color: #9A9483; text-decoration: line-through;">${change.from}</span>
                  <span style="color: #5F624F;"> &rarr; </span>
                  <span>${change.to}</span>
                </td>
              </tr>`
    )
    .join("");
}

function layout(p: {
  heading: string;
  eyebrow?: string;
  greeting: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}): string {
  const cta = p.ctaUrl && p.ctaLabel
    ? `
          <div style="text-align: center; margin: 40px 0 20px 0;">
            <a href="${p.ctaUrl}" style="background-color: #FDCC4B; color: #26300D; padding: 18px 36px; text-decoration: none; border-radius: 16px; font-weight: 900; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px;">${p.ctaLabel}</a>
          </div>
          <p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">
            Button not working? Copy and paste this link:<br>
            <a href="${p.ctaUrl}" style="color: #26300D; text-decoration: underline; margin-top: 8px; display: inline-block;">${p.ctaUrl}</a>
          </p>`
    : "";

  const footnote = p.footnote
    ? `<p style="font-size: 12px; color: #5F624F; text-align: center; margin-top: 24px; font-weight: 500;">${p.footnote}</p>`
    : "";

  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F7F4EA; margin: 0; padding: 24px 10px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #E6DFC8;">
        <div style="background-color: #26300D; padding: 32px 16px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">${p.heading}</h1>
          <p style="color: #FDCC4B; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">${p.eyebrow ?? "Don Fenticas"}</p>
        </div>
        <div style="padding: 32px 20px; color: #1F1F1A;">
          <h2 style="margin-top: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${p.greeting}</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #5F624F; font-weight: 500;">${p.intro}</p>
          <div style="background-color: #F7F4EA; border: 2px solid #E6DFC8; border-radius: 16px; padding: 20px 16px; margin: 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">${p.bodyHtml}
            </table>
          </div>${cta}
          ${footnote}
        </div>
        <div style="background-color: #1F1F1A; padding: 30px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #E6DFC8; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; opacity: 0.6;">Don Fenticas · Licensed Venue</p>
        </div>
      </div>
    </div>
  `;
}

function bookingDetailRows(b: BookingSnapshot): DetailRow[] {
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

export function buildBookingChangedEmail(p: {
  booking: BookingSnapshot;
  changes: BookingChange[];
  manageUrl: string;
  changedByAdmin?: boolean;
}): BookingEmail {
  return {
    subject: `Booking updated: ${p.booking.eventTitle} @ Don Fenticas`,
    html: layout({
      heading: p.booking.eventTitle,
      greeting: `Hey ${p.booking.customerName}!`,
      intro: p.changedByAdmin
        ? "We've updated your booking. Here's what changed - if this doesn't look right, please get in touch."
        : "Your booking has been updated. Here's what changed.",
      bodyHtml: changeRowsHtml(p.changes),
      ctaLabel: "View Booking",
      ctaUrl: p.manageUrl,
    }),
  };
}

export function buildBookingCancelledEmail(p: {
  booking: BookingSnapshot;
  cancelledByAdmin?: boolean;
}): BookingEmail {
  return {
    subject: `Booking cancelled: ${p.booking.eventTitle} @ Don Fenticas`,
    html: layout({
      heading: p.booking.eventTitle,
      greeting: `Hey ${p.booking.customerName},`,
      intro: p.cancelledByAdmin
        ? "Your booking has been cancelled by the venue. If you weren't expecting this, please get in touch."
        : "Your booking has been cancelled. Sorry to miss you - you're welcome back any time.",
      bodyHtml: detailRowsHtml(bookingDetailRows(p.booking)),
      footnote: "If you paid for this booking, refunds are handled by our team - please allow 3–5 business days.",
    }),
  };
}

function adminContactRows(b: BookingSnapshot): DetailRow[] {
  return [
    { label: "Reference", value: `#${b.bookingId}` },
    { label: "Customer", value: b.customerName },
    { label: "Email", value: b.customerEmail },
  ];
}

export function buildAdminNewBookingEmail(p: {
  booking: BookingSnapshot;
  adminUrl: string;
}): BookingEmail {
  console.log("buildAdminNewBookingEmail", JSON.stringify(p, null, 2), "adminUrl:", p.adminUrl);
  return {
    subject: `New booking - ${p.booking.eventTitle}, ${formatEventDate(p.booking.eventDate)} (${people(p.booking.groupSize)})`,
    html: layout({
      heading: "New Booking",
      eyebrow: p.booking.eventTitle,
      greeting: "A booking just came in",
      intro: `${p.booking.customerName} booked ${people(p.booking.groupSize).toLowerCase()} for <strong>${p.booking.eventTitle}</strong>.`,
      bodyHtml: detailRowsHtml([...adminContactRows(p.booking), ...bookingDetailRows(p.booking)]),
      ctaLabel: "Open In Admin",
      ctaUrl: p.adminUrl,
    }),
  };
}

export function buildAdminBookingChangedEmail(p: {
  booking: BookingSnapshot;
  changes: BookingChange[];
  adminUrl: string;
}): BookingEmail {
  return {
    subject: `Booking changed - ${p.booking.eventTitle}, ${formatEventDate(p.booking.eventDate)} (#${p.booking.bookingId})`,
    html: layout({
      heading: "Booking Changed",
      eyebrow: p.booking.eventTitle,
      greeting: "A customer edited their booking",
      intro: `${p.booking.customerName} updated booking <strong>#${p.booking.bookingId}</strong> for <strong>${p.booking.eventTitle}</strong>.`,
      bodyHtml: [changeRowsHtml(p.changes), detailRowsHtml(adminContactRows(p.booking))].join(""),
      ctaLabel: "Open In Admin",
      ctaUrl: p.adminUrl,
    }),
  };
}

export function buildAdminBookingCancelledEmail(p: {
  booking: BookingSnapshot;
  adminUrl: string;
}): BookingEmail {
  return {
    subject: `Booking cancelled - ${p.booking.eventTitle}, ${formatEventDate(p.booking.eventDate)} (#${p.booking.bookingId})`,
    html: layout({
      heading: "Booking Cancelled",
      eyebrow: p.booking.eventTitle,
      greeting: "A booking was cancelled",
      intro: `${p.booking.customerName} cancelled booking <strong>#${p.booking.bookingId}</strong> for <strong>${p.booking.eventTitle}</strong>. Any table held for it has been released.`,
      bodyHtml: detailRowsHtml([...adminContactRows(p.booking), ...bookingDetailRows(p.booking)]),
      ctaLabel: "Open In Admin",
      ctaUrl: p.adminUrl,
    }),
  };
}
