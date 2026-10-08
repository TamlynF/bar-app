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
/* Private hire emails that send the customer to their request page. */
const HIRE_ACTION_SLOTS: SlotKey[] = ["subject", "greeting", "intro", "ctaLabel", "footnote"];

const HIRE_DATE: MergeField = { token: "hireDate", label: "Hire date", sample: "Sat, 14 Nov 2026" };
const HIRE_TIME: MergeField = { token: "hireTime", label: "Hire time", sample: "7:00pm - 11:00pm" };
const HIRE_REASON: MergeField = { token: "hireReason", label: "Reason for hire", sample: "Birthday" };
const REQUEST_STATUS: MergeField = { token: "requestStatus", label: "Request status", sample: "cancelled" };
const EARLIER_PAYMENT: MergeField = {
  token: "earlierPayment",
  label: "Earlier payment",
  sample: "£500.00 by bank transfer",
};
const DEPOSIT_AMOUNT: MergeField = { token: "depositAmount", label: "Deposit amount", sample: "£100.00" };
const REFUND_AMOUNT: MergeField = { token: "refundAmount", label: "Refund amount", sample: "£100.00" };
const REFUND_METHOD: MergeField = {
  token: "refundMethod",
  label: "How it was refunded",
  sample: "back to the card you paid with",
};
const REFUND_FAILURE: MergeField = {
  token: "refundFailure",
  label: "Why Square couldn't refund it",
  sample: "The payment is too old to refund online.",
};
const DEPOSIT_OUTCOME: MergeField = {
  token: "depositOutcome",
  label: "What's happening with the deposit",
  sample: "Your £100.00 deposit has been refunded to the card you paid with - allow 5-10 working days for it to show.",
};
const DEPOSIT_DUE: MergeField = { token: "depositDueDate", label: "Deposit due date", sample: "Fri, 16 Oct 2026" };
const HIRE_RESPONSE: MergeField = {
  token: "customerResponse",
  label: "What the customer did",
  sample: "accepted the proposed time",
};
const HIRE_FIELDS = [CUSTOMER_NAME, HIRE_DATE, HIRE_TIME, HIRE_REASON];

export const EMAIL_SCENARIOS: EmailScenario[] = [
  /* ── Bookings ─────────────────────────────────────────────────────────── */
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
      footnote:
        "Can't make it? Please cancel at least 24 hours in advance using Manage Booking, so we can offer your place to someone else.",
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
    key: "admin.band.act_response",
    label: "Band - act replied from their offer page",
    group: "Band bookings",
    description: "Sent to the venue when an act accepts, asks to discuss, or withdraws from the buttons in their offer email.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [
      { token: "bookerName", label: "Contact name", sample: "Sam Rivers" },
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
      { token: "actResponse", label: "What the act did", sample: "accepted the offer" },
      { token: "eventDate", label: "Offered slot", sample: "Sat, 14 Nov 2026, 10:00 PM - 11:30 PM" },
    ],
    defaults: slots({
      subject: "Band: {{groupName}} {{actResponse}}",
      greeting: "Band Offer Update",
      intro: "{{groupName}} has {{actResponse}} for {{eventDate}}.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "band.offered",
    label: "Slot offered to an act",
    group: "Band bookings",
    description:
      "Staff move a band request to Offered. The proposed slot card is generated, with Accept / Discuss / Withdraw buttons that open the act's offer page.",
    recipient: "customer",
    slots: [...BAND_SLOTS, "cardTitle", "noteTitle"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      cardTitle: "Proposed Slot",
      noteTitle: "Note from our team",
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
    slots: [...BAND_SLOTS, "cardTitle", "noteTitle"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      cardTitle: "Performance Date",
      noteTitle: "Note from our team",
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
    slots: [...BAND_SLOTS, "noteTitle"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      noteTitle: "Note from our team",
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
    slots: [...BAND_SLOTS, "cardTitle"],
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
      cardTitle: "New Performance Slot",
      subject: "Please confirm your updated performance slot - Don Fenticas",
      heading: "Slot Updated",
      greeting: "Hey {{customerName}},",
      intro:
        "We've updated the proposed date and time for your performance at Don Fenticas{{groupSuffix}}.\n\nPlease review the new slot below and reply to this email to confirm it works for you. Your booking is on hold until we hear back.",
    }),
  },
  {
    key: "band.fee_updated",
    label: "Act fee updated",
    group: "Band bookings",
    description: "Staff change the fee on an offered or booked act and choose to tell them. The slot card shows the new fee.",
    recipient: "customer",
    slots: [...BAND_SLOTS, "cardTitle", "noteTitle"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
    ],
    defaults: slots({
      cardTitle: "Updated Fee",
      noteTitle: "Note from our team",
      subject: "Updated fee for your performance - Don Fenticas",
      heading: "Fee Updated",
      greeting: "Hi {{customerName}},",
      intro: "We've updated the fee for {{groupName}}'s performance at Don Fenticas. Here are the details:",
      outro: "Reply to this email if you have any questions about the change.",
    }),
  },
  {
    key: "band.invoice",
    label: "Invoice request after a gig",
    group: "Band bookings",
    description:
      "Sent automatically on Monday morning to every booked act that played in the last seven days and hasn't had one yet. Attach the invoice template here; bank details on a completed one that's sent back are copied to the booking and the act.",
    recipient: "customer",
    slots: [...BAND_SLOTS, "cardTitle"],
    mergeFields: [
      CUSTOMER_NAME,
      { token: "groupName", label: "Act / group name", sample: "The Wandering Hearts" },
      { token: "eventDate", label: "Performance date", sample: "Friday, 25 September 2026" },
      { token: "fee", label: "Agreed fee, or blank", sample: "£150" },
    ],
    defaults: slots({
      cardTitle: "Your Performance",
      subject: "Thanks for playing at Don Fenticas - please send your invoice",
      heading: "Thanks for Playing!",
      greeting: "Hi {{customerName}},",
      intro:
        "A huge thank you to {{groupName}} for playing at Don Fenticas. We really enjoyed having you, and we hope you had a great night too.",
      outro:
        "So we can get you paid, please reply to this email with your invoice, including the bank details you'd like us to pay into.\n\nIf you don't have an invoice of your own, we've attached a simple template you can fill in and send back - just add your bank details and the amount.\n\nThanks again, and we hope to see you back on our stage soon.",
    }),
  },
  /* ── Private hire ─────────────────────────────────────────────────────── */
  {
    key: "private_hire.enquiry.customer",
    label: "Private hire enquiry received",
    group: "Private hire",
    description:
      "Sent to the enquirer when the public private-hire form is submitted. The button opens their request page.",
    recipient: "customer",
    slots: [...SIMPLE_SLOTS, "ctaLabel"],
    mergeFields: [CUSTOMER_NAME],
    defaults: slots({
      subject: "Private Hire Enquiry Received - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thank you for your private hire enquiry at <strong>Don Fenticas</strong>. We've received your request and our team will be in touch shortly to discuss availability and details.",
      outro: "🏠 Don Fenticas - Private Hire Enquiries",
      ctaLabel: "View Your Request",
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
    key: "private_hire.proposed",
    label: "Private hire - new time proposed",
    group: "Private hire",
    description:
      "Staff suggest a different date or time. The button opens the customer's request page, where they accept or turn it down.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: HIRE_FIELDS,
    defaults: slots({
      subject: "We've Suggested a Time for Your Private Hire - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thanks for your private hire request. We can't do the exact time you asked for, but we'd love to host your <strong>{{hireReason}}</strong> on <strong>{{hireDate}}</strong>, {{hireTime}}.\n\nHave a look and let us know if it works for you.",
      ctaLabel: "Review and Accept",
      footnote: "Questions? Just reply to this email.",
    }),
  },
  {
    key: "private_hire.approved",
    label: "Private hire approved - deposit due",
    group: "Private hire",
    description:
      "The times are agreed. Asks the customer to pay the deposit; the button opens their request page with the payment link.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_AMOUNT, DEPOSIT_DUE],
    defaults: slots({
      subject: "Your Private Hire is Approved - Deposit Due",
      greeting: "Hi {{customerName}}!",
      intro:
        "Good news - we can host you on <strong>{{hireDate}}</strong>, {{hireTime}}.\n\nTo secure the date, please pay your <strong>{{depositAmount}}</strong> deposit by <strong>{{depositDueDate}}</strong>. We'll hold the date for you until then.",
      ctaLabel: "Pay Deposit",
      footnote:
        "If the deposit isn't paid by {{depositDueDate}} the date will be released. Questions? Just reply to this email.",
    }),
  },
  {
    key: "private_hire.deposit_updated",
    label: "Private hire - deposit amount changed",
    group: "Private hire",
    description:
      "Staff change the deposit while the customer is still due to pay. The button opens their request page with a payment link for the new amount.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_AMOUNT, DEPOSIT_DUE],
    defaults: slots({
      subject: "Your Private Hire Deposit Has Been Updated",
      greeting: "Hi {{customerName}}!",
      intro:
        "We've updated the deposit for your <strong>{{hireReason}}</strong> on <strong>{{hireDate}}</strong>, {{hireTime}}.\n\nThe deposit is now <strong>{{depositAmount}}</strong>, due by <strong>{{depositDueDate}}</strong>. If you'd already started paying, please use the button below so you pay the new amount.",
      ctaLabel: "Pay Deposit",
      footnote:
        "If the deposit isn't paid by {{depositDueDate}} the date will be released. Questions? Just reply to this email.",
    }),
  },
  {
    key: "private_hire.rescheduled",
    label: "Private hire - date or time changed",
    group: "Private hire",
    description:
      "Staff move an agreed hire to a new date or time. Sent while the deposit is due (with the deposit details and a fresh payment link) and after it's confirmed.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_AMOUNT, DEPOSIT_DUE],
    defaults: slots({
      subject: "Your Private Hire Has Moved - Don Fenticas",
      greeting: "Hi {{customerName}}!",
      intro:
        "Your <strong>{{hireReason}}</strong> is now on <strong>{{hireDate}}</strong>, {{hireTime}}.\n\nThe updated details are below. If anything doesn't look right, just reply to this email.",
      ctaLabel: "View Your Request",
      footnote: "Questions? Just reply to this email.",
    }),
  },
  {
    key: "private_hire.time_turned_down",
    label: "Private hire - proposed time turned down",
    group: "Private hire",
    description:
      "The customer says the proposed time doesn't work on their request page. Lets them know the team has their message and will come back with another option.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: HIRE_FIELDS,
    defaults: slots({
      subject: "Thanks - We'll Find Another Time for Your Private Hire",
      greeting: "Hi {{customerName}}!",
      intro:
        "Thanks for letting us know the time we suggested for your <strong>{{hireReason}}</strong> doesn't work.\n\nWe've passed your message to the team and we'll be in touch with another option soon.",
      ctaLabel: "View Your Request",
      footnote: "Questions? Just reply to this email.",
    }),
  },
  {
    key: "private_hire.deposit_reminder",
    label: "Private hire deposit reminder",
    group: "Private hire",
    description: "Sent automatically two days before an unpaid deposit is due.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_AMOUNT, DEPOSIT_DUE],
    defaults: slots({
      subject: "Reminder: Your Private Hire Deposit is Due {{depositDueDate}}",
      greeting: "Hi {{customerName}}!",
      intro:
        "Just a reminder that the <strong>{{depositAmount}}</strong> deposit for your private hire on <strong>{{hireDate}}</strong> is due by <strong>{{depositDueDate}}</strong>. Pay it now to keep your date.",
      ctaLabel: "Pay Deposit",
      footnote: "Already paid? Thank you - you can ignore this email.",
    }),
  },
  {
    key: "private_hire.confirmed",
    label: "Private hire confirmed",
    group: "Private hire",
    description: "The deposit is paid (or there was none), so the hire is confirmed and on the schedule.",
    recipient: "customer",
    slots: HIRE_ACTION_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_AMOUNT],
    defaults: slots({
      subject: "Your Private Hire Has Been Confirmed! 🎉",
      greeting: "Hi {{customerName}}!",
      intro:
        "We're delighted to confirm your private hire at Don Fenticas on <strong>{{hireDate}}</strong>, {{hireTime}}. We can't wait to host you!",
      ctaLabel: "View Booking",
      footnote: "If you have questions, please reply to this email.",
    }),
  },
  {
    key: "private_hire.declined",
    label: "Private hire declined",
    group: "Private hire",
    description: "Staff turn a private hire request down.",
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
  {
    key: "private_hire.cancelled",
    label: "Private hire cancelled",
    group: "Private hire",
    description:
      "A request is cancelled - by the customer from their request page, or by staff after the times were agreed.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: HIRE_FIELDS,
    defaults: slots({
      subject: "Your Private Hire Has Been Cancelled - Don Fenticas",
      greeting: "Hi {{customerName}},",
      intro: "Your private hire request for your <strong>{{hireReason}}</strong> has been cancelled.",
      footnote: "If this wasn't expected, please reply to this email.",
    }),
  },
  {
    key: "private_hire.booking_cancelled",
    label: "Private hire booking cancelled",
    group: "Private hire",
    description:
      "Staff cancel a private hire that was already confirmed. The deposit line says it's been refunded when the refund was made in the same step, otherwise that we'll be in touch about it.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_OUTCOME],
    defaults: slots({
      subject: "Your Private Hire Booking Has Been Cancelled - Don Fenticas",
      greeting: "Hi {{customerName}},",
      intro:
        "We're sorry - your private hire booking for your <strong>{{hireReason}}</strong> on <strong>{{hireDate}}</strong>, {{hireTime}}, has been cancelled.\n\n{{depositOutcome}}",
      footnote: "If you have any questions, please reply to this email.",
    }),
  },
  {
    key: "private_hire.deposit_refunded",
    label: "Private hire deposit refunded",
    group: "Private hire",
    description:
      "Sent to the customer when staff refund some or all of their deposit - back to their card through Square, or recorded after paying it back another way.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [...HIRE_FIELDS, REFUND_AMOUNT, REFUND_METHOD],
    defaults: slots({
      subject: "Your Private Hire Deposit Refund - Don Fenticas",
      greeting: "Hi {{customerName}},",
      intro:
        "We've refunded <strong>{{refundAmount}}</strong> of the deposit for your <strong>{{hireReason}}</strong> on {{hireDate}}, {{refundMethod}}.",
      footnote: "If you have any questions, please reply to this email.",
    }),
  },
  {
    key: "private_hire.expired",
    label: "Private hire deposit expired",
    group: "Private hire",
    description: "Sent automatically when a deposit isn't paid by its due date and the date is released.",
    recipient: "customer",
    slots: SIMPLE_SLOTS,
    mergeFields: [...HIRE_FIELDS, DEPOSIT_DUE],
    defaults: slots({
      subject: "Your Private Hire Date Has Been Released - Don Fenticas",
      greeting: "Hi {{customerName}},",
      intro:
        "The deposit for your private hire on <strong>{{hireDate}}</strong> wasn't paid by {{depositDueDate}}, so we've released the date.\n\nIf you'd still like to book, just reply to this email and we'll see what we can do.",
      footnote: "",
    }),
  },
  {
    key: "admin.private_hire.customer_response",
    label: "Private hire - customer replied",
    group: "Private hire",
    description:
      "Sent to the venue when a customer accepts or turns down proposed times, or cancels, from their request page.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME, HIRE_RESPONSE, HIRE_DATE],
    defaults: slots({
      subject: "Private Hire: {{customerName}} {{customerResponse}}",
      greeting: "Private Hire Update",
      intro: "{{customerName}} has {{customerResponse}} for {{hireDate}}.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "admin.private_hire.deposit_paid",
    label: "Private hire - deposit paid",
    group: "Private hire",
    description: "Sent to the venue when a private hire deposit is paid online and the hire is confirmed.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME, HIRE_DATE, DEPOSIT_AMOUNT],
    defaults: slots({
      subject: "Deposit Paid - {{customerName}}, {{hireDate}}",
      greeting: "Private Hire Deposit Paid",
      intro:
        "{{customerName}} has paid the <strong>{{depositAmount}}</strong> deposit. The hire on {{hireDate}} is confirmed and on the schedule.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "admin.private_hire.extra_payment",
    label: "Private hire - paid again after it was confirmed",
    group: "Private hire",
    description:
      "Sent to the venue when a card payment arrives for a private hire that was already confirmed - usually a deposit paid another way and then the old checkout paid too. Check Square and refund the duplicate.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME, HIRE_DATE, DEPOSIT_AMOUNT, EARLIER_PAYMENT],
    defaults: slots({
      subject: "Second Payment on a Confirmed Private Hire - {{customerName}}",
      greeting: "A Confirmed Hire Was Paid Again",
      intro:
        "{{customerName}} has paid <strong>{{depositAmount}}</strong> by card for their private hire on {{hireDate}}, but it was already confirmed ({{earlierPayment}}).\n\nThey may have paid twice. Check Square and refund the duplicate.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "admin.private_hire.closed_payment",
    label: "Private hire - paid after it closed",
    group: "Private hire",
    description:
      "Sent to the venue when a customer pays a deposit checkout after their request was cancelled, declined or expired. The payment is recorded on the request; refund it in Square or reopen the request.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME, HIRE_DATE, DEPOSIT_AMOUNT, REQUEST_STATUS],
    defaults: slots({
      subject: "Payment on a Closed Private Hire - {{customerName}}",
      greeting: "Deposit Paid After the Request Closed",
      intro:
        "{{customerName}} has paid <strong>{{depositAmount}}</strong> by card, but their private hire request for {{hireDate}} was already <strong>{{requestStatus}}</strong>.\n\nThe payment is recorded on the request. Refund it in Square, or reopen the request if the hire is going ahead.",
      ctaLabel: "View Request",
    }),
  },
  {
    key: "admin.private_hire.refund_failed",
    label: "Private hire - card refund failed",
    group: "Private hire",
    description:
      "Sent to the venue when Square reports that a deposit refund made from the app didn't go through. The request shows the refund as failed; sort it out in Square.",
    recipient: "admin",
    slots: ALERT_SLOTS,
    mergeFields: [CUSTOMER_NAME, HIRE_DATE, REFUND_AMOUNT, REFUND_FAILURE],
    defaults: slots({
      subject: "Refund Failed - {{customerName}}, {{hireDate}}",
      greeting: "A Deposit Refund Didn't Go Through",
      intro:
        "Square couldn't complete the <strong>{{refundAmount}}</strong> refund to {{customerName}} for their private hire on {{hireDate}}.\n\n{{refundFailure}}\n\nThe customer has already been told it was on its way, so refund it in Square and let them know.",
      ctaLabel: "View Request",
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
  "booking.event.confirmed",
  "booking.event.waitlisted",
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
  "private_hire.declined",
  "private_hire.cancelled",
  "private_hire.booking_cancelled",
  "private_hire.proposed",
  "private_hire.approved",
  "private_hire.deposit_updated",
  "private_hire.rescheduled",
  "private_hire.time_turned_down",
  "private_hire.deposit_reminder",
  "private_hire.expired",
  "admin.private_hire.customer_response",
  "admin.private_hire.deposit_paid",
  "admin.private_hire.closed_payment",
  "admin.private_hire.extra_payment",
  "private_hire.deposit_refunded",
  "admin.private_hire.refund_failed",
  "admin.band.act_response",
  "band.offered",
  "band.booked",
  "band.declined",
  "band.rescheduled",
  "band.fee_updated",
  "band.invoice",
]);

export function isWired(key: string): boolean {
  return WIRED_SCENARIOS.has(key);
}

const BY_KEY = new Map(EMAIL_SCENARIOS.map((s) => [s.key, s]));

/* Which of the three email designs a scenario is drawn with. */
const PLAIN_SCENARIOS = new Set([
  "enquiry.received.customer",
  "enquiry.received.admin",
  "enquiry.reply",
  "band.application.customer",
  "band.application.admin",
  "admin.band.act_response",
  "private_hire.enquiry.customer",
  "private_hire.enquiry.admin",
  "private_hire.confirmed",
  "private_hire.declined",
  "private_hire.cancelled",
  "private_hire.booking_cancelled",
  "private_hire.proposed",
  "private_hire.approved",
  "private_hire.deposit_updated",
  "private_hire.rescheduled",
  "private_hire.time_turned_down",
  "private_hire.deposit_reminder",
  "private_hire.expired",
  "admin.private_hire.customer_response",
  "admin.private_hire.deposit_paid",
  "admin.private_hire.closed_payment",
  "admin.private_hire.extra_payment",
  "private_hire.deposit_refunded",
  "admin.private_hire.refund_failed",
]);

export function scenarioFamily(scenario: EmailScenario): "band" | "brand" | "plain" {
  if (PLAIN_SCENARIOS.has(scenario.key)) return "plain";
  if (scenario.group === "Band bookings") return "band";
  return "brand";
}

export function findScenario(key: string): EmailScenario | undefined {
  return BY_KEY.get(key);
}

/* The values a preview stands in for. Real sends pass their own. */
export function sampleValues(scenario: EmailScenario): Record<string, string> {
  return Object.fromEntries(scenario.mergeFields.map((f) => [f.token, f.sample]));
}
