/* Every transactional email the app sends, and the copy it ships with.

   This list is code, not data, because each entry corresponds to a code path
   that fires it - a scenario cannot be invented or deleted from the admin page
   without a matching send site. What the admin page *can* do is override the
   copy (rows in public.email_templates) or switch a scenario off entirely.

   The `slots` array is what the editor shows for each scenario. Anything not
   listed there is generated: the booking detail tables, the change lists, a
   band's proposed-slot card, the note an admin types at send time, and the
   field dumps in the admin alerts. None of those can be authored as free text
   because their number of rows varies with the data.

   Defaults below are transcribed verbatim from what each site sent before the
   templates moved here - installing this must not change a single email. */

import { EMPTY_SLOTS, type SlotKey, type TemplateSlots } from "./render";

export type EmailRecipient = "customer" | "admin";

export type MergeField = {
  token: string;
  label: string;
  sample: string;
};

export type EmailScenario = {
  key: string;
  label: string;
  group: string;
  description: string;
  recipient: EmailRecipient;
  slots: SlotKey[];
  defaults: TemplateSlots;
  mergeFields: MergeField[];
};

const slots = (over: Partial<TemplateSlots>): TemplateSlots => ({ ...EMPTY_SLOTS, ...over });

const CUSTOMER_NAME: MergeField = {
  token: "customerName",
  label: "Customer name",
  sample: "Jane Doe",
};
const EVENT_TITLE: MergeField = { token: "eventTitle", label: "Event title", sample: "Quiz Night" };
const EVENT_DATE: MergeField = { token: "eventDate", label: "Event date", sample: "Thu, 4 Sep 2026" };
const GROUP_NAME: MergeField = { token: "groupName", label: "Team / group name", sample: "The Quizzards" };
const GROUP_SIZE: MergeField = { token: "groupSize", label: "Party size", sample: "4 People" };
const BOOKING_ID: MergeField = { token: "bookingId", label: "Booking reference", sample: "1042" };
const CUSTOMER_EMAIL: MergeField = {
  token: "customerEmail",
  label: "Customer email",
  sample: "jane@example.com",
};
/* The venue's public address, from company_information - not the Resend sender. */
const CONTACT_EMAIL: MergeField = {
  token: "contactEmail",
  label: "Venue contact email",
  sample: "admin@bookingsdonfenticas.co.uk",
};

const BOOKING_FIELDS = [CUSTOMER_NAME, EVENT_TITLE, EVENT_DATE, GROUP_NAME, GROUP_SIZE, BOOKING_ID];

const BOOKING_SLOTS: SlotKey[] = ["subject", "heading", "greeting", "intro", "ctaLabel", "footnote"];
const ADMIN_SLOTS: SlotKey[] = [
  "subject",
  "heading",
  "eyebrow",
  "greeting",
  "intro",
  "ctaLabel",
  "footnote",
];
const BAND_SLOTS: SlotKey[] = ["subject", "heading", "greeting", "intro", "outro"];
const SIMPLE_SLOTS: SlotKey[] = ["subject", "greeting", "intro", "outro", "footnote"];
/* The admin alerts carry a button through to the request in the portal. */
const ALERT_SLOTS: SlotKey[] = [...SIMPLE_SLOTS, "ctaLabel"];

export const EMAIL_SCENARIOS: EmailScenario[] = [
  /* ── Bookings ─────────────────────────────────────────────────────────── */
  {
    key: "booking.quiz.confirmed",
    label: "Quiz table confirmed",
    group: "Bookings",
    description: "The customer books a quiz table and there is room for them.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "Quiz Night Table Confirmed! 🎉",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro: `Great news! Your team "{{groupName}}" is locked in.`,
      ctaLabel: "Manage Booking",
    }),
  },
  {
    key: "booking.quiz.waitlisted",
    label: "Quiz table waitlisted",
    group: "Bookings",
    description: "The customer books a quiz table but the night is already full.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "You are on the Waitlist",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro: `We're currently full, so "{{groupName}}" has been added to our waitlist.`,
      ctaLabel: "Manage Booking",
    }),
  },
  {
    key: "booking.event.confirmed",
    label: "Event booking confirmed",
    group: "Bookings",
    description:
      "A ticketed event booking is confirmed - both the free path and once a Square payment settles.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: [...BOOKING_FIELDS, CONTACT_EMAIL],
    defaults: slots({
      subject: "🎫 Booking Confirmed: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro: "Your spot for <strong>{{eventTitle}}</strong> is officially secured for {{groupSize}}.",
      ctaLabel: "Manage Booking",
    }),
  },
  {
    key: "booking.event.waitlisted",
    label: "Event booking waitlisted",
    group: "Bookings",
    description: "A ticketed event is full, so the booking goes on the waitlist.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "📋 You're on the Waitlist: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro:
        "We're currently fully booked for this date, so you've been added to our waitlist. We'll notify you immediately if a spot opens up!",
      ctaLabel: "Manage Booking",
    }),
  },
  {
    key: "booking.bingo.confirmed",
    label: "Music Bingo confirmed",
    group: "Bookings",
    description:
      "A Music Bingo booking is confirmed - both the free path and once a Square payment settles.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: [...BOOKING_FIELDS, CONTACT_EMAIL],
    defaults: slots({
      subject: "🎫 Booking Confirmed: Music Bingo @ Don Fenticas 🎵",
      heading: "Music Bingo",
      greeting: "Hey {{customerName}}!",
      intro:
        "Get ready to mark off those cards and sing along! Your spot for <strong>Music Bingo</strong> is officially secured for {{groupSize}}.",
      ctaLabel: "Manage Booking",
      footnote: "Questions? Email us at {{contactEmail}}",
    }),
  },
  {
    key: "booking.bingo.waitlisted",
    label: "Music Bingo waitlisted",
    group: "Bookings",
    description: "Music Bingo is full, so the booking goes on the waitlist.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "📋 You're on the Waitlist: Music Bingo @ Don Fenticas",
      heading: "Music Bingo",
      greeting: "Hey {{customerName}}!",
      intro:
        "We're currently fully booked for this date, so you've been added to our waitlist. We'll notify you immediately if a spot opens up!",
      ctaLabel: "Manage Booking",
    }),
  },
  {
    key: "booking.payment_pending",
    label: "Payment not finished",
    group: "Bookings",
    description:
      "A Square checkout link was issued but the customer has not paid, so the spot is not yet held.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      EVENT_TITLE,
      EVENT_DATE,
      GROUP_SIZE,
      { token: "amountDue", label: "Amount due", sample: "£24.00" },
    ],
    defaults: slots({
      subject: "Finish your booking: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Almost there, {{customerName}}!",
      intro:
        "We've saved your details for <strong>{{eventTitle}}</strong>, but we haven't received your payment yet - so your spot isn't secured. Finish checkout below and you're in.",
      ctaLabel: "Complete Payment",
      footnote: "Unpaid bookings are released automatically, so please complete payment soon.",
    }),
  },
  {
    key: "booking.changed.by_customer",
    label: "Booking changed by the customer",
    group: "Bookings",
    description: "The customer edited their own booking from the manage-booking page.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "Booking updated: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro: "Your booking has been updated. Here's what changed.",
      ctaLabel: "View Booking",
    }),
  },
  {
    key: "booking.changed.by_admin",
    label: "Booking changed by the venue",
    group: "Bookings",
    description: "Staff edited a booking from the admin portal.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "Booking updated: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}}!",
      intro:
        "We've updated your booking. Here's what changed - if this doesn't look right, please get in touch.",
      ctaLabel: "View Booking",
    }),
  },
  {
    key: "booking.cancelled.by_customer",
    label: "Booking cancelled by the customer",
    group: "Bookings",
    description: "The customer cancelled from the manage-booking page.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "Booking cancelled: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}},",
      intro: "Your booking has been cancelled. Sorry to miss you - you're welcome back any time.",
      footnote:
        "If you paid for this booking, refunds are handled by our team - please allow 3–5 business days.",
    }),
  },
  {
    key: "booking.cancelled.by_admin",
    label: "Booking cancelled by the venue",
    group: "Bookings",
    description: "Staff cancelled a booking from the admin portal.",
    recipient: "customer",
    slots: BOOKING_SLOTS,
    mergeFields: BOOKING_FIELDS,
    defaults: slots({
      subject: "Booking cancelled: {{eventTitle}} @ Don Fenticas",
      heading: "{{eventTitle}}",
      greeting: "Hey {{customerName}},",
      intro:
        "Your booking has been cancelled by the venue. If you weren't expecting this, please get in touch.",
      footnote:
        "If you paid for this booking, refunds are handled by our team - please allow 3–5 business days.",
    }),
  },

  /* ── Admin notifications ──────────────────────────────────────────────── */
  {
    key: "admin.booking.new",
    label: "New booking landed",
    group: "Admin notifications",
    description: "Sent to the venue whenever any booking is created or a payment settles.",
    recipient: "admin",
    slots: ADMIN_SLOTS,
    mergeFields: [
      ...BOOKING_FIELDS,
      CUSTOMER_EMAIL,
      { token: "groupSizeLower", label: "Party size, lower case", sample: "4 people" },
    ],
    defaults: slots({
      subject: "New booking - {{eventTitle}}, {{eventDate}} ({{groupSize}})",
      heading: "New Booking",
      eyebrow: "{{eventTitle}}",
      greeting: "A booking just came in",
      intro: "{{customerName}} booked {{groupSizeLower}} for <strong>{{eventTitle}}</strong>.",
      ctaLabel: "Open In Admin",
    }),
  },
  {
    key: "admin.booking.changed",
    label: "Customer edited a booking",
    group: "Admin notifications",
    description: "Sent to the venue when a customer changes their own booking.",
    recipient: "admin",
    slots: ADMIN_SLOTS,
    mergeFields: [...BOOKING_FIELDS, CUSTOMER_EMAIL],
    defaults: slots({
      subject: "Booking changed - {{eventTitle}}, {{eventDate}} (#{{bookingId}})",
      heading: "Booking Changed",
      eyebrow: "{{eventTitle}}",
      greeting: "A customer edited their booking",
      intro:
        "{{customerName}} updated booking <strong>#{{bookingId}}</strong> for <strong>{{eventTitle}}</strong>.",
      ctaLabel: "Open In Admin",
    }),
  },
  {
    key: "admin.booking.cancelled",
    label: "Customer cancelled a booking",
    group: "Admin notifications",
    description: "Sent to the venue when a customer cancels their own booking.",
    recipient: "admin",
    slots: ADMIN_SLOTS,
    mergeFields: [...BOOKING_FIELDS, CUSTOMER_EMAIL],
    defaults: slots({
      subject: "Booking cancelled - {{eventTitle}}, {{eventDate}} (#{{bookingId}})",
      heading: "Booking Cancelled",
      eyebrow: "{{eventTitle}}",
      greeting: "A booking was cancelled",
      intro:
        "{{customerName}} cancelled booking <strong>#{{bookingId}}</strong> for <strong>{{eventTitle}}</strong>. Any table held for it has been released.",
      ctaLabel: "Open In Admin",
    }),
  },

  /* ── Enquiries ────────────────────────────────────────────────────────── */
  {
    key: "enquiry.received.customer",
    label: "Enquiry acknowledgement",
    group: "Enquiries",
    description: "Sent to whoever submits the contact form on the public site.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "We've got your message - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thanks for getting in touch with <strong>Don Fenticas</strong>. We've received your message and one of the team will get back to you shortly.",
      outro: "🎸 Don Fenticas - Grassroots Live Music & Nightlife, Hinckley",
      footnote: "If it's urgent, you can reply directly to this email.",
    }),
  },
  {
    key: "enquiry.received.admin",
    label: "New enquiry alert",
    group: "Enquiries",
    description: "Sent to the venue when the public contact form is submitted.",
    recipient: "admin",
    slots: SIMPLE_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      { token: "enquirySubject", label: "Enquiry subject", sample: "Function room hire" },
      {
        token: "subjectSuffix",
        label: "Subject suffix - \": subject\", or blank when none was given",
        sample: ": Function room hire",
      },
    ],
    defaults: slots({
      subject: "New Enquiry - {{customerName}}{{subjectSuffix}}",
      greeting: "New Enquiry",
    }),
  },
  {
    key: "enquiry.reply",
    label: "Staff reply to an enquiry",
    group: "Enquiries",
    description:
      "Sent when staff reply from the admin portal. The reply itself is typed at send time - this is the wrapper around it.",
    recipient: "customer",
    slots: ["subject", "greeting", "footnote"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "enquirySubject", label: "Original subject", sample: "Function room hire" },
    ],
    defaults: slots({
      subject: "Re: {{enquirySubject}} - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      footnote: "Reply to this email to continue the conversation.",
    }),
  },

  /* ── Band bookings ────────────────────────────────────────────────────── */
  {
    key: "band.application.customer",
    label: "Band application received",
    group: "Band bookings",
    description: "Sent to the act when they apply to play through the public form.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "Band Application Received - Don Fenticas",
      greeting: "Hey {{customerName}}!",
      intro:
        "Thanks for applying to perform at <strong>Don Fenticas</strong>. We've received your application and our team will review it shortly.\n\nWe'll be in touch via email once we've had a chance to review your details.",
      outro: "🎸 Don Fenticas - Live Music Venue",
      footnote: "If you have any questions, reply to this email.",
    }),
  },
  {
    key: "band.application.admin",
    label: "New band application alert",
    group: "Band bookings",
    description: "Sent to the venue when an act applies through the public form.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [{ token: "bookerName", label: "Booker name", sample: "Sam Rivers" }],
    defaults: slots({
      subject: "New Band Application - {{bookerName}}",
      greeting: "New Band Application",
      intro: "A new band/artist has applied to perform at Don Fenticas.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "band.offered",
    label: "Slot offered to an act",
    group: "Band bookings",
    description: "Staff move a band request to Offered. The proposed slot card is generated.",
    recipient: "customer",
    slots: BAND_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      subject: "We'd love to book you, {{groupName}} - Don Fenticas",
      heading: "We'd Love to Book You",
      greeting: "Hi {{customerName}},",
      intro:
        "Great news - we'd love to have {{groupName}} play at Don Fenticas. Here's what we're offering:",
      outro:
        "Reply to this email to accept the slot or discuss details - once you confirm, we'll lock it in and it goes on our events calendar.",
    }),
  },
  {
    key: "band.booked",
    label: "Act confirmed",
    group: "Band bookings",
    description: "Staff move a band request to Booked.",
    recipient: "customer",
    slots: BAND_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      subject: "Your Performance at Don Fenticas is Confirmed!",
      heading: "You're Confirmed!",
      greeting: "Hey {{customerName}},",
      intro: "Great news! Your application to perform at Don Fenticas has been confirmed.",
      outro:
        "We'll be in touch closer to the date with any further details. If you have any questions in the meantime, just reply to this email.",
    }),
  },
  {
    key: "band.declined",
    label: "Act declined",
    group: "Band bookings",
    description: "Staff move a band request to Declined.",
    recipient: "customer",
    slots: BAND_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      subject: "Update on Your Application - Don Fenticas",
      heading: "Application Update",
      greeting: "Hey {{customerName}},",
      intro:
        "Thank you for applying to perform at Don Fenticas. After reviewing your application, we're unable to proceed at this time.",
      outro: "We appreciate your interest and encourage you to apply again in the future.",
    }),
  },
  {
    key: "band.rescheduled",
    label: "Act slot rescheduled",
    group: "Band bookings",
    description: "Staff change the date or time of a confirmed booking, sending it back to Offered.",
    recipient: "customer",
    slots: BAND_SLOTS,
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
      {
        token: "groupSuffix",
        label: "Act name in brackets, or blank when the act has no name",
        sample: " (The Wandering Hearts)",
      },
    ],
    defaults: slots({
      subject: "Please confirm your updated performance slot - Don Fenticas",
      heading: "Slot Updated",
      greeting: "Hey {{customerName}},",
      intro:
        "We've updated the proposed date and time for your performance at Don Fenticas{{groupSuffix}}.\n\nPlease review the new slot below and reply to this email to confirm it works for you. Your booking is on hold until we hear back.",
    }),
  },

  /* ── Private hire ─────────────────────────────────────────────────────── */
  {
    key: "private_hire.enquiry.customer",
    label: "Private hire enquiry received",
    group: "Private hire",
    description: "Sent to the enquirer when the public private-hire form is submitted.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "Private Hire Enquiry Received - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thank you for your private hire enquiry at <strong>Don Fenticas</strong>. We've received your request and our team will be in touch shortly to discuss availability and details.",
      outro: "🏠 Don Fenticas - Private Hire Enquiries",
      footnote: "If you have any urgent questions, please reply to this email.",
    }),
  },
  {
    key: "private_hire.enquiry.admin",
    label: "New private hire enquiry alert",
    group: "Private hire",
    description: "Sent to the venue when the public private-hire form is submitted.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "New Private Hire Enquiry - {{customerName}}",
      greeting: "New Private Hire Enquiry",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "private_hire.confirmed",
    label: "Private hire confirmed",
    group: "Private hire",
    description: "Staff mark a private hire request confirmed.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "Your Private Hire Enquiry Has Been Confirmed! 🎉",
      greeting: "Hi {{customerName}}!",
      intro:
        "We're delighted to confirm your private hire booking at Don Fenticas. Our team will be in touch shortly with the next steps.",
      footnote: "If you have questions, please reply to this email.",
    }),
  },
  {
    key: "private_hire.cancelled",
    label: "Private hire declined",
    group: "Private hire",
    description: "Staff mark a private hire request cancelled.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "Update on Your Private Hire Enquiry - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thank you for your private hire enquiry. Unfortunately we're unable to accommodate your request at this time.",
      footnote: "If you have questions, please reply to this email.",
    }),
  },
];

export const EMAIL_SCENARIO_GROUPS = [
  "Bookings",
  "Admin notifications",
  "Enquiries",
  "Band bookings",
  "Private hire",
] as const;

/* Scenarios whose send site already reads its copy from here. The rest still run
   on the literals compiled into their call site, so the settings page says so
   rather than letting someone carefully edit words that will never be sent.
   A key moves into this set in the same change that cuts its send site over. */
const WIRED_SCENARIOS = new Set([
  "booking.quiz.confirmed",
  "booking.quiz.waitlisted",
  "booking.event.confirmed",
  "booking.event.waitlisted",
  "booking.bingo.confirmed",
  "booking.bingo.waitlisted",
  "booking.payment_pending",
  "booking.changed.by_customer",
  "booking.changed.by_admin",
  "booking.cancelled.by_customer",
  "booking.cancelled.by_admin",
  "admin.booking.new",
  "admin.booking.changed",
  "admin.booking.cancelled",
  "enquiry.received.customer",
  "enquiry.received.admin",
  "enquiry.reply",
  "band.application.customer",
  "band.application.admin",
  "private_hire.enquiry.customer",
  "private_hire.enquiry.admin",
  "private_hire.confirmed",
  "private_hire.cancelled",
  "band.offered",
  "band.booked",
  "band.declined",
  "band.rescheduled",
]);

export function isWired(key: string): boolean {
  return WIRED_SCENARIOS.has(key);
}

const BY_KEY = new Map(EMAIL_SCENARIOS.map((s) => [s.key, s]));

export function findScenario(key: string): EmailScenario | undefined {
  return BY_KEY.get(key);
}

/* The values a preview stands in for. Real sends pass their own. */
export function sampleValues(scenario: EmailScenario): Record<string, string> {
  return Object.fromEntries(scenario.mergeFields.map((f) => [f.token, f.sample]));
}
