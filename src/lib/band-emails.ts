
import { toHHMM } from "@/lib/event-clash";

function formatTime12(t?: string | null): string {
  const hhmm = toHHMM(t);
  if (!hhmm) return "";
  const [hh, mm] = hhmm.split(":");
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatDateLong(d?: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type BandEmail = {
  subject: string;
  heading: string;
  greeting: string;
  body: string[];
  dateLabel: string; // "" when no date
  timeLabel: string; // "" when no times
  slotLabel?: string;
  feeLabel?: string;
  noteLabel?: string;
};

export type RescheduleEmail = BandEmail;

export function buildRescheduleEmail(p: {
  name: string;
  groupName?: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
}): BandEmail {
  const dateLabel = formatDateLong(p.date);
  const timeLabel = [formatTime12(p.startTime), formatTime12(p.endTime)].filter(Boolean).join(" – ");

  return {
    subject: "Please confirm your updated performance slot — Don Fenticas",
    heading: "Slot Updated",
    greeting: `Hey ${p.name},`,
    body: [
      `We've updated the proposed date and time for your performance at Don Fenticas${p.groupName ? ` (${p.groupName})` : ""}.`,
      "Please review the new slot below and reply to this email to confirm it works for you. Your booking is on hold until we hear back.",
    ],
    dateLabel,
    timeLabel,
  };
}

export function buildOfferEmail(p: {
  name: string;
  groupName?: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  paymentAmount?: number | null;
  notes?: string | null;
}): BandEmail {
  const dateLabel = formatDateLong(p.date);
  const timeLabel = [formatTime12(p.startTime), formatTime12(p.endTime)].filter(Boolean).join(" – ");
  const slotLabel = dateLabel
    ? [dateLabel, timeLabel].filter(Boolean).join(", ")
    : "to be arranged";

  return {
    subject: `We'd love to book you${p.groupName ? `, ${p.groupName}` : ""} — Don Fenticas`,
    heading: "We'd Love to Book You",
    greeting: `Hi ${p.name},`,
    body: [
      `Great news — we'd love to have ${p.groupName ?? "you"} play at Don Fenticas. Here's what we're offering:`,
      "Reply to this email to accept the slot or discuss details — once you confirm, we'll lock it in and it goes on our events calendar.",
    ],
    dateLabel,
    timeLabel,
    slotLabel,
    feeLabel: p.paymentAmount != null ? `Fee: £${p.paymentAmount}` : "",
    noteLabel: p.notes?.trim() || "",
  };
}

export function buildOutcomeEmail(p: {
  name: string;
  groupName?: string | null;
  outcome: "confirmed" | "cancelled";
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  notes?: string | null;
}): BandEmail {
  const isConfirmed = p.outcome === "confirmed";
  const dateLabel = formatDateLong(p.date);
  const timeLabel = [formatTime12(p.startTime), formatTime12(p.endTime)].filter(Boolean).join(" – ");

  return {
    subject: isConfirmed
      ? "Your Performance at Don Fenticas is Confirmed!"
      : "Update on Your Application — Don Fenticas",
    heading: isConfirmed ? "You're Confirmed!" : "Application Update",
    greeting: `Hey ${p.name},`,
    body: isConfirmed
      ? [
          "Great news! Your application to perform at Don Fenticas has been confirmed.",
          "We'll be in touch closer to the date with any further details. If you have any questions in the meantime, just reply to this email.",
        ]
      : [
          "Thank you for applying to perform at Don Fenticas. After reviewing your application, we're unable to proceed at this time.",
          "We appreciate your interest and encourage you to apply again in the future.",
        ],
    dateLabel: isConfirmed ? dateLabel : "",
    timeLabel: isConfirmed ? timeLabel : "",
    noteLabel: p.notes?.trim() || "",
  };
}
