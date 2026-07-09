// Pure builders for band-booking emails. Returning structured content (not HTML)
// lets the admin UI preview exactly what will be sent, while the server action
// wraps the same content into the branded HTML template — one source of truth.

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

export type RescheduleEmail = {
  subject: string;
  heading: string;
  greeting: string;
  body: string[];
  dateLabel: string; // "" when no date
  timeLabel: string; // "" when no times
};

/**
 * Email a band receives when an admin changes the date/time of an already-booked
 * booking. It asks them to re-confirm the new slot (the booking has been moved back
 * to "offered" until they do).
 */
export function buildRescheduleEmail(p: {
  name: string;
  groupName?: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
}): RescheduleEmail {
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
