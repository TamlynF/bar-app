import { formatDateLong, formatTime12 } from "@/lib/band-emails";
import { CHANNEL_LABELS, type MetaChannel } from "@/lib/meta/channels";

export type ActResponseKey = "accept" | "discuss" | "withdraw";

export type QuickReply = { title: string; payload: string };

/* Quick replies carry the request id and the answer back through the webhook,
   so a tap on "Yes, I accept" is handled like a click on the offer page. */
export function bandOfferPayload(requestId: string, response: ActResponseKey): string {
  return `band_offer:${requestId}:${response}`;
}

export function parseBandOfferPayload(
  payload: string | null | undefined
): { requestId: string; response: ActResponseKey } | null {
  const m = (payload ?? "").match(/^band_offer:([0-9a-f-]{36}):(accept|discuss|withdraw)$/i);
  return m ? { requestId: m[1], response: m[2].toLowerCase() as ActResponseKey } : null;
}

/* Instagram allows 20 characters per quick-reply title. */
export const BAND_OFFER_REPLIES: { response: ActResponseKey; title: string }[] = [
  { response: "accept", title: "Yes, I accept" },
  { response: "discuss", title: "Let's discuss" },
  { response: "withdraw", title: "Withdraw" },
];

export function bandOfferQuickReplies(requestId: string): QuickReply[] {
  return BAND_OFFER_REPLIES.map((r) => ({ title: r.title, payload: bandOfferPayload(requestId, r.response) }));
}

export type BandOfferMessageInput = {
  name: string;
  groupName: string | null;
  venueName: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  paymentAmount: number | null;
  previousPaymentAmount?: number | null;
  offerUrl: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/* The chat version of the offer email: the slot, the fee (saying when it
   changed), and the offer page link for anyone whose app hides the quick
   replies. Staff can edit it before sending; edits are not kept. */
export function bandOfferMessageText(p: BandOfferMessageInput): string {
  const who = p.groupName || "you";
  const date = formatDateLong(p.date);
  const time = [formatTime12(p.startTime), formatTime12(p.endTime)].filter(Boolean).join(" – ");
  const slot = date ? [date, time].filter(Boolean).join(", ") : "date and time to be arranged";
  const feeChanged =
    p.previousPaymentAmount != null && p.paymentAmount != null && p.previousPaymentAmount !== p.paymentAmount;
  const fee =
    p.paymentAmount == null
      ? null
      : feeChanged
        ? `Fee: £${p.paymentAmount} (updated from £${p.previousPaymentAmount})`
        : `Fee: £${p.paymentAmount}`;

  return [
    `Hi ${firstName(p.name)}!`,
    `Great news - we'd love to have ${who} play at ${p.venueName}. Here's what we're offering:`,
    [`When: ${slot}`, fee].filter(Boolean).join("\n"),
    `Tap a reply below, or use your offer page to accept, discuss or withdraw:\n${p.offerUrl}`,
    "Once you confirm, we'll lock it in and it goes on our events calendar.",
  ].join("\n\n");
}

/* What the chat says back after a quick reply is tapped; the outcome is the
   request's status once the answer has been applied. */
export function bandOfferAckText(response: ActResponseKey, outcome: string, venueName: string): string {
  if (response === "accept") {
    return outcome === "booked"
      ? `Brilliant - you're booked at ${venueName}. We've emailed the details, and the night is on our calendar.`
      : "Thanks - we've got your yes. We'll sort out the final slot details and confirm by email shortly.";
  }
  if (response === "discuss") return "No problem - tell us what you'd like to change and we'll get back to you here.";
  return "Understood - we've withdrawn your application. Thanks for getting in touch, and good luck with the gigs.";
}

export function quickReplyHint(channel: MetaChannel): string {
  return `Quick replies show in the ${CHANNEL_LABELS[channel]} app until they type something else; the link works everywhere.`;
}
