import { toParagraphs, type TemplateSlots } from "@/lib/email/render";

export type PrivateHireEmail = {
  subject: string;
  heading: string;
  greeting: string;
  body: string[];
  noteLabel?: string;
};

export type PrivateHireEmailKey =
  | "private_hire.approved"
  | "private_hire.deposit_updated"
  | "private_hire.rescheduled"
  | "private_hire.proposed"
  | "private_hire.confirmed"
  | "private_hire.declined"
  | "private_hire.cancelled"
  | "private_hire.booking_cancelled"
  | "private_hire.deposit_refunded";

/* Turns resolved copy into the shape the admin preview renders. The note is
   typed by staff when they take the action, so it never lives in the
   template - only the wording around it does. */
export function buildPrivateHireOutcomeEmail(p: {
  slots: TemplateSlots;
  notes?: string | null;
}): PrivateHireEmail {
  return {
    subject: p.slots.subject,
    heading: p.slots.greeting,
    greeting: p.slots.greeting,
    body: toParagraphs(p.slots.intro),
    noteLabel: p.notes?.trim() || "",
  };
}
