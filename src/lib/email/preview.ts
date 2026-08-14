/* Building the sample email shown on the settings page.

   The preview goes through the same shells and the same renderer a real send
   does, so what an admin approves is what lands in an inbox. Only the generated
   block is stood in for - a preview has no real booking to list rows from, so a
   representative one is supplied here. */

import {
  bandCard,
  bandLayout,
  bandNote,
  brandLayout,
  changeRowsHtml,
  detailRowsHtml,
  plainLayout,
  plainNote,
} from "./layout";
import { renderSlots, type TemplateSlots } from "./render";
import { sampleValues, type EmailScenario } from "./scenarios";

const SAMPLE_BOOKING_ROWS = [
  { label: "📅 Date", value: "Thu, 4 Sep 2026" },
  { label: "🍺 Team", value: "The Quizzards" },
  { label: "👥 Size", value: "4 People" },
];

const SAMPLE_CHANGE_ROWS = [
  { label: "Party Size", from: "2 People", to: "4 People" },
  { label: "Date", from: "Thu, 4 Sep 2026", to: "Thu, 11 Sep 2026" },
];

const SAMPLE_ADMIN_ROWS = [
  { label: "Reference", value: "#1042" },
  { label: "Customer", value: "Jane Doe" },
  { label: "Email", value: "jane@example.com" },
  ...SAMPLE_BOOKING_ROWS,
];

const SAMPLE_FIELDS_PANEL = [
  ["Name", "Jane Doe"],
  ["Email", "jane@example.com"],
  ["Phone", "07700 900123"],
  ["Message", "Do you take bookings for birthdays?"],
]
  .map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`)
  .join("");

const SAMPLE_URL = "https://example.test/manage-booking/1042";

const PLAIN_SCENARIOS = new Set([
  "enquiry.received.customer",
  "enquiry.received.admin",
  "enquiry.reply",
  "band.application.customer",
  "band.application.admin",
  "private_hire.enquiry.customer",
  "private_hire.enquiry.admin",
  "private_hire.confirmed",
  "private_hire.cancelled",
]);

const ADMIN_ALERT_SCENARIOS = new Set([
  "enquiry.received.admin",
  "band.application.admin",
  "private_hire.enquiry.admin",
]);

function bandMiddle(key: string): string {
  if (key === "band.offered") {
    return (
      bandCard("Proposed Slot", "Saturday, 12 September 2026, 8:00 PM – 10:30 PM", "Fee: £250") +
      bandNote("Load-in from 6pm, please bring your own DI boxes.")
    );
  }
  if (key === "band.rescheduled") {
    return bandCard("New Performance Slot", "Saturday, 12 September 2026", "8:00 PM – 10:30 PM");
  }
  if (key === "band.booked") {
    return bandCard("Performance Date", "Saturday, 12 September 2026", "8:00 PM – 10:30 PM");
  }
  return "";
}

export function previewHtml(scenario: EmailScenario, slots: TemplateSlots): string {
  const { slots: filled } = renderSlots(slots, sampleValues(scenario));

  if (scenario.group === "Band bookings" && !PLAIN_SCENARIOS.has(scenario.key)) {
    return bandLayout({
      slots: filled,
      groupName: "The Wandering Hearts",
      middleHtml: bandMiddle(scenario.key),
      tailHtml:
        scenario.key === "band.booked" || scenario.key === "band.declined"
          ? bandNote("Thanks again for playing with us last spring.")
          : "",
    });
  }

  if (PLAIN_SCENARIOS.has(scenario.key)) {
    const isAdminAlert = ADMIN_ALERT_SCENARIOS.has(scenario.key);
    return plainLayout({
      slots: filled,
      panelHtml: isAdminAlert ? SAMPLE_FIELDS_PANEL : undefined,
      bodyHtml:
        scenario.key === "private_hire.confirmed" || scenario.key === "private_hire.cancelled"
          ? plainNote("We can hold the back room from 7pm.")
          : scenario.key === "enquiry.reply"
            ? `<p style="white-space:pre-wrap;">Yes - we take birthday bookings any night except Thursdays. Give us a call and we'll sort it.</p>`
            : undefined,
      ctaUrl: isAdminAlert ? SAMPLE_URL : undefined,
      trailer: isAdminAlert ? "Enquiry ID: 3f0c1a92" : undefined,
    });
  }

  const isChangeEmail =
    scenario.key === "booking.changed.by_customer" ||
    scenario.key === "booking.changed.by_admin" ||
    scenario.key === "admin.booking.changed";

  const bodyHtml = isChangeEmail
    ? changeRowsHtml(SAMPLE_CHANGE_ROWS)
    : detailRowsHtml(scenario.recipient === "admin" ? SAMPLE_ADMIN_ROWS : SAMPLE_BOOKING_ROWS);

  return brandLayout({
    slots: filled,
    bodyHtml,
    ctaUrl: filled.ctaLabel ? SAMPLE_URL : undefined,
  });
}

/* The subject as it would appear in an inbox, for the line above the preview. */
export function previewSubject(scenario: EmailScenario, slots: TemplateSlots): string {
  return renderSlots(slots, sampleValues(scenario)).slots.subject;
}
