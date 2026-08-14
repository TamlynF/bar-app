import { toHHMM } from "@/lib/event-clash";
import { toParagraphs, type MergeValues, type TemplateSlots } from "@/lib/email/render";

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

export type BandEmailKind = "offered" | "booked" | "declined" | "rescheduled";

export const bandScenarioKey = (kind: BandEmailKind) => `band.${kind}`;

export type BandEmail = {
  subject: string;
  heading: string;
  greeting: string;
  /** Paragraphs above the slot card. */
  body: string[];
  /** Paragraphs below it. */
  outro: string[];
  dateLabel: string; // "" when no date
  timeLabel: string; // "" when no times
  slotLabel?: string;
  feeLabel?: string;
  noteLabel?: string;
};

export type RescheduleEmail = BandEmail;

export function bandMergeValues(p: {
  name: string;
  groupName?: string | null;
}): MergeValues {
  return {
    customerName: p.name,
    groupName: p.groupName ?? "you",
    /* Blank rather than "()" when the act has no name of its own. */
    groupSuffix: p.groupName ? ` (${p.groupName})` : "",
  };
}

/* One builder for all four band emails: now that the copy comes from the
   template, the only thing that varies between them is which labels the slot
   card gets and whether a declined act still sees a date. */
export function buildBandEmail(p: {
  slots: TemplateSlots;
  kind: BandEmailKind;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  paymentAmount?: number | null;
  notes?: string | null;
}): BandEmail {
  const dateLabel = formatDateLong(p.date);
  const timeLabel = [formatTime12(p.startTime), formatTime12(p.endTime)]
    .filter(Boolean)
    .join(" – ");

  const declined = p.kind === "declined";
  const offered = p.kind === "offered";

  return {
    subject: p.slots.subject,
    heading: p.slots.heading,
    greeting: p.slots.greeting,
    body: toParagraphs(p.slots.intro),
    outro: toParagraphs(p.slots.outro),
    /* A declined act is not being given a date, so the card is dropped. */
    dateLabel: declined ? "" : dateLabel,
    timeLabel: declined ? "" : timeLabel,
    slotLabel: offered
      ? dateLabel
        ? [dateLabel, timeLabel].filter(Boolean).join(", ")
        : "to be arranged"
      : undefined,
    feeLabel: offered && p.paymentAmount != null ? `Fee: £${p.paymentAmount}` : "",
    noteLabel: p.notes?.trim() || "",
  };
}

/* The heading each email's slot card carries. */
export function bandSlotCardLabel(kind: BandEmailKind): string {
  if (kind === "offered") return "Proposed Slot";
  if (kind === "rescheduled") return "New Performance Slot";
  return "Performance Date";
}
